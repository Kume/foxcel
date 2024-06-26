import {SelectUIModel, SelectUIModelCurrentValue} from './UIModelTypes';
import {AppAction, AppDataModelAction} from '../App/AppState';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  dataModelEquals,
  dataModelIsList,
  dataModelIsNull,
  dataModelToLabelString,
  dataModelToString,
  emptyListModel,
  mapListDataModel,
  nullDataModel,
  pushToListData,
  stringToDataModel,
  stringToNumberDataModel,
  unknownToDataModel,
} from '../DataModel/DataModel';
import {collectDataModel, getDataModelBySinglePath} from '../DataModel/DataModelCollector';
import {DataModelContext, DataModelContextWithoutSchema, DataModelRoot} from '../DataModel/DataModelContext';
import {fillTemplateLineAndToString} from '../DataModel/TemplateEngine';
import {dataSchemaIsString, SelectDynamicOptionSchema} from '../DataModel/DataSchema';
import {SelectUISchema} from './UISchemaTypes';
import {selectOptionGetCurrent} from '../DataModel/SelectOption';

export interface SelectUIOption {
  readonly label: string;
  readonly value: string;
  readonly data: DataModel;
}

export function getSelectUIOptions(model: SelectUIModel, root: DataModelRoot): SelectUIOption[] {
  return getSelectUIOptionsImpl(model.schema, model.data, DataModelContext.deserialize(model.dataContext, root));
}

function getSelectUIOptionsImpl(
  schema: SelectUISchema,
  data: DataModel | undefined,
  dataContext: DataModelContext,
): SelectUIOption[] {
  const options: SelectUIOption[] = [];
  const excludeOptions: DataModel[] =
    schema.isMulti && dataModelIsList(data) ? mapListDataModel(data, (data) => data) : [];

  for (const optionSchema of schema.options) {
    if (optionSchema.label === undefined) {
      // Dynamic option
      const collectResults = collectDataModel(optionSchema.path, dataContext.toWithoutSchema());
      for (const {data, context} of collectResults) {
        if (excludeOptions.every((excludeOption) => !dataModelEquals(excludeOption, data))) {
          options.push(formatDynamicSelectUIOption(optionSchema, data, context));
        }
      }
    } else {
      // Static option
      const data = unknownToDataModel(optionSchema.value);
      if (excludeOptions.every((excludeOption) => !dataModelEquals(excludeOption, data))) {
        options.push({
          label: optionSchema.label,
          value: optionSchema.value.toString(),
          data,
        });
      }
    }
  }

  return options;
}

export function getSelectUIOptionsWithSchema(schema: SelectUISchema, dataContext: DataModelContext): SelectUIOption[] {
  return getSelectUIOptionsImpl(schema, undefined, dataContext);
}

export function selectUIModelSetValue(model: SelectUIModel, value: SelectUIOption | null): AppAction {
  if (model.isMulti) {
    if (value === null) {
      throw new Error('MultiSelectで選択解除はこのメソッドでは行わない想定。(View側で制御)');
    }
    if (model.data !== undefined) {
      return {
        type: 'data',
        action: {
          type: 'push',
          dataContext: model.dataContext,
          data: value.value,
        },
      };
    } else {
      // もともと対象データが配列でなければ、今回選択した要素を一つ持った配列で初期化する。
      return {
        type: 'data',
        action: {
          type: 'set',
          dataContext: model.dataContext,
          data: pushToListData(emptyListModel, value.value),
        },
      };
    }
  } else {
    if (value === null) {
      return {
        type: 'data',
        action: {
          type: 'delete',
          dataContext: model.dataContext,
        },
      };
    } else {
      return {
        type: 'data',
        action: {
          type: 'set',
          dataContext: model.dataContext,
          data: value.value,
        },
      };
    }
  }
}

export function selectUIModelSetString(model: SelectUIModel, value: string, root: DataModelRoot) {
  const resultData = selectUIModelHandleInputForSchema(
    model.schema,
    value,
    DataModelContext.deserialize(model.dataContext, root),
  );
  return resultData === undefined
    ? undefined
    : ({
        type: 'data',
        action: {type: 'set', dataContext: model.dataContext, data: resultData},
      } as const satisfies AppDataModelAction);
}

export function formatDynamicSelectUIOption(
  option: SelectDynamicOptionSchema,
  data: DataModel,
  context: DataModelContextWithoutSchema,
): SelectUIOption {
  const stringValue = dataModelToString(option.valuePath ? getDataModelBySinglePath(option.valuePath, context) : data);
  return {
    label: option.labelTemplate ? fillTemplateLineAndToString(option.labelTemplate, context) : dataModelToString(data),
    value: stringValue,
    data: data,
  };
}

export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel,
  context: DataModelContext,
): SelectUIModelCurrentValue;
export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel | undefined,
  context: DataModelContext,
): SelectUIModelCurrentValue | undefined;
export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel | undefined,
  context: DataModelContext,
): SelectUIModelCurrentValue | undefined {
  if (dataModel === undefined) {
    return undefined;
  }
  const current = selectOptionGetCurrent(schema.options, dataModel, context);
  switch (current?.t) {
    case 'static':
      return {label: current.label, value: current.option.value.toString(), data: dataModel};
    case 'dynamic':
      return formatDynamicSelectUIOption(current.option, current.data, current.context);
    default:
      return {isInvalid: true, data: dataModel};
  }
}

export function filterSelectUIOptionsByText(options: readonly SelectUIOption[], text: string): SelectUIOption[] {
  const searchText = text.toLocaleLowerCase().trim();
  return options.filter(
    ({label, value}) =>
      label.toLocaleLowerCase().indexOf(searchText) >= 0 || value.toLocaleLowerCase().indexOf(searchText) >= 0,
  );
}

export function selectUIModelHandleInputForSchema(
  schema: SelectUISchema,
  input: string | null,
  dataContext: DataModelContext,
): DataModel | undefined {
  const valueDataModel = inputValueToDataModel(schema, input);
  if (dataModelIsNull(valueDataModel)) {
    return nullDataModel;
  } else if (valueDataModel === undefined) {
    return undefined;
  }
  // 入力データに対応する選択肢が存在すれば入力データをそのまま返す
  // 見つかった選択肢のデータはvaluePathが未考慮のため、そのままセットできるデータとは限らないためあくまで入力可能かどうかを判断するためだけに利用する
  return selectOptionGetCurrent(schema.options, valueDataModel, dataContext) ? valueDataModel : undefined;
}

function inputValueToDataModel(schema: SelectUISchema, input: string | null): DataModel | undefined {
  if (input === null) {
    return nullDataModel;
  }
  return dataSchemaIsString(schema.dataSchema) ? stringToDataModel(input) : stringToNumberDataModel(input);
}

export function selectUIModelCurrentLabel(current: SelectUIModelCurrentValue | undefined): string | undefined {
  if (current?.isInvalid) {
    return dataModelToLabelString(current?.data);
  } else {
    return current?.label;
  }
}
