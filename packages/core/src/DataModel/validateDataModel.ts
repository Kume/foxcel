import {DataModelContext, SerializedDataModelContext} from './DataModelContext';
import {
  dataModelIsBoolean,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsMapOrList,
  dataModelIsNull,
  dataModelIsNumber,
  dataModelIsString,
  eachListDataItem,
  eachMapDataItem,
  getMapDataKeys,
  mapDataModelKeys,
  mapOrListDataModelIsMap,
  numberDataModelToNumber,
  stringDataModelToString,
} from './DataModel';
import {DataSchemaType} from './DataSchema';
import {ValidationErrorMessageKey} from './ValidationErrorMessage';
import {getDataModelBySinglePath} from './DataModelCollector';
import {selectOptionGetCurrent} from './SelectOption';

export type DataModelValidationError = readonly [key: ValidationErrorMessageKey, conetxt: SerializedDataModelContext];
export type DataModelValidationErrors = readonly [
  readonly DataModelValidationError[],
  readonly DataModelValidationError[],
];

export async function validateDataModel(context: DataModelContext): Promise<DataModelValidationErrors> {
  const errors: DataModelValidationError[] = [];
  const warnings: DataModelValidationError[] = [];
  await validateDataModelRecursive(context, errors, warnings);
  return [errors, warnings];
}

async function validateDataModelRecursive(
  context: DataModelContext,
  errors: DataModelValidationError[],
  warnings: DataModelValidationError[],
): Promise<void> {
  const model = context.currentModel;
  const schema = context.schemaContext.currentSchema;

  if (model === undefined || dataModelIsNull(model)) {
    if (schema?.required) {
      errors.push(['required', context.serialize()]);
    }
    return;
  } else if (dataModelIsMap(model)) {
    const keys = getMapDataKeys(model);
    const existingKeys = new Set<string>();
    for (const [index, key] of keys.entries()) {
      if (key == null) {
        warnings.push(['map_key_is_null', context.pushMapIndex(index, key).pushIsParentKey().serialize()]);
      } else {
        if (existingKeys.has(key)) {
          errors.push(['map_key_is_duplicated', context.pushMapIndex(index, key).pushIsParentKey().serialize()]);
        } else {
          // TODO キーのフォーマットチェック
          existingKeys.add(key);
        }
      }
    }
  }

  // スキーマが無いならエラーになりようがない
  if (schema === undefined) {
    return;
  }

  switch (schema.t) {
    case DataSchemaType.Key:
      // TODO ここに入ることは無い気がする
      break;
    case DataSchemaType.Number:
      if (dataModelIsNumber(model)) {
        const value = numberDataModelToNumber(model);
        switch (schema.numberType) {
          case 'unsignedInteger':
            if (!Number.isInteger(value)) {
              errors.push(['number_must_be_integer', context.serialize()]);
            } else if (schema.min === undefined && value < 0) {
              errors.push(['minus_number_is_not_arrowed', context.serialize()]);
            }
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push(['is_greater_than_maximum', context.serialize()]);
        } else if (schema.min !== undefined && value < schema.min) {
          errors.push(['is_less_than_minimum', context.serialize()]);
        }
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.Boolean:
      if (dataModelIsBoolean(model)) {
        // TODO
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.String:
      if (dataModelIsString(model)) {
        const stringValue = stringDataModelToString(model);
        if (schema.in) {
          if (!selectOptionGetCurrent(schema.in, model, context)) {
            errors.push(['invalid_option', context.serialize()]);
          }
        }
        // TODO
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.Map:
      if (dataModelIsMap(model)) {
        if (schema.mappedFrom) {
          const mappingSource = getDataModelBySinglePath(schema.mappedFrom, context.toWithoutSchema());
          if (mappingSource !== undefined) {
            if (dataModelIsMap(mappingSource)) {
              const sourceKeys = new Set(mapDataModelKeys(mappingSource));
              for (const [, , key, index] of eachMapDataItem(model)) {
                if (key !== null && !sourceKeys.has(key)) {
                  errors.push(['mapping_source_key_does_not_exist', context.pushMapIndex(index, key).serialize()]);
                }
              }
            } else {
              errors.push(['mapping_source_is_invalid_data_type', context.serialize()]);
            }
          }
        }
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.FixedMap:
      if (dataModelIsMap(model)) {
        // TODO
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.List:
      if (dataModelIsList(model)) {
        // TODO
      } else {
        errors.push(['invalid_data_type', context.serialize()]);
      }
      break;
    case DataSchemaType.Conditional:
      // TODO
      break;
  }

  if (dataModelIsMapOrList(model)) {
    if (mapOrListDataModelIsMap(model)) {
      for (const [, , key, index] of eachMapDataItem(model)) {
        await validateDataModelRecursive(context.pushMapIndex(index, key), errors, warnings);
      }
    } else {
      for (const [, , index] of eachListDataItem(model)) {
        await validateDataModelRecursive(context.pushListIndex(index), errors, warnings);
      }
    }
  }
}
