import {SelectUIModel, SelectUIModelCurrentValue} from './UIModelTypes';
import {AppAction} from '../App/AppState';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  dataModelEquals,
  dataModelEqualsToUnknown,
  dataModelIsList,
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
import {collectDataModel} from '../DataModel/DataModelCollector';
import {DataModelContext, DataModelRoot} from '../DataModel/DataModelContext';
import {fillTemplateLineAndToString} from '../DataModel/TemplateEngine';
import {dataSchemaIsString, SelectDynamicOptionSchema} from '../DataModel/DataSchema';
import {findDataModel} from '../DataModel/DataModelSearcher';
import {SelectUISchema} from './UISchemaTypes';

export interface SelectUIOption {
  readonly label: string;
  readonly value: string;
  readonly data: DataModel;
}

export function getSelectUIOptions(model: SelectUIModel, root: DataModelRoot): SelectUIOption[] {
  return getSelectUIOptionsImpl(model.schema, model.data, DataModelContext.deserialize(model.dataContext, root), root);
}

function getSelectUIOptionsImpl(
  schema: SelectUISchema,
  data: DataModel | undefined,
  dataContext: DataModelContext,
  root: DataModelRoot,
): SelectUIOption[] {
  const options: SelectUIOption[] = [];
  const excludeOptions: DataModel[] =
    schema.isMulti && dataModelIsList(data) ? mapListDataModel(data, (data) => data) : [];

  for (const optionSchema of schema.options) {
    if (optionSchema.label === undefined) {
      // Dynamic option
      const collectResults = collectDataModel(optionSchema.path, data, dataContext, root);
      for (const {data, context} of collectResults) {
        if (excludeOptions.every((excludeOption) => !dataModelEquals(excludeOption, data))) {
          options.push(formatDynamicSelectUIOption(optionSchema, data, context, root));
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

export function getSelectUIOptionsWithSchema(
  schema: SelectUISchema,
  dataContext: DataModelContext,
  root: DataModelRoot,
): SelectUIOption[] {
  return getSelectUIOptionsImpl(schema, undefined, dataContext, root);
}

export function selectUIModelSetValue(model: SelectUIModel, value: SelectUIOption | null): AppAction {
  if (model.isMulti) {
    if (value === null) {
      throw new Error('MultiSelectで選択解除はこのメソッドでは行わない想定。(View側で制御)');
    }
    if (model.data) {
      return {
        type: 'data',
        action: {
          type: 'push',
          dataContext: model.dataContext,
          data: value.data,
        },
      };
    } else {
      // もともと対象データが配列でなければ、今回選択した要素を一つ持った配列で初期化する。
      return {
        type: 'data',
        action: {
          type: 'set',
          dataContext: model.dataContext,
          data: pushToListData(emptyListModel, value.data),
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
          data: value.data,
        },
      };
    }
  }
}

export function selectUIModelSetString(
  model: SelectUIModel,
  value: string,
  root: DataModelRoot,
): AppAction | undefined {
  const resultData = selectUIModelHandleInputForSchema(
    model.schema,
    value,
    DataModelContext.deserialize(model.dataContext, root),
    root,
  );
  return resultData === undefined
    ? undefined
    : {type: 'data', action: {type: 'set', dataContext: model.dataContext, data: resultData}};
}

export function formatDynamicSelectUIOption(
  option: SelectDynamicOptionSchema,
  data: DataModel,
  context: DataModelContext,
  root: DataModelRoot,
): SelectUIOption {
  const stringValue = dataModelToString(data);
  return {
    label: option.labelTemplate ? fillTemplateLineAndToString(option.labelTemplate, data, context, root) : stringValue,
    value: stringValue,
    data: data,
  };
}

export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel,
  context: DataModelContext,
  dataRoot: DataModelRoot,
): SelectUIModelCurrentValue;
export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel | undefined,
  context: DataModelContext,
  dataRoot: DataModelRoot,
): SelectUIModelCurrentValue | undefined;
export function selectUIModelGetCurrent(
  schema: SelectUISchema,
  dataModel: DataModel | undefined,
  context: DataModelContext,
  dataRoot: DataModelRoot,
): SelectUIModelCurrentValue | undefined {
  if (dataModel === undefined) {
    return undefined;
  }
  for (const option of schema.options) {
    if (option.label === undefined) {
      // Dynamic option
      const findResult = findDataModel(
        dataModel,
        // TODO matcherは暫定対応なので、後でちゃんと実装する
        {path: option.path, matcher: {type: 'equal', operand1: option.valuePath, operand2: dataModel}},
        context,
        dataRoot,
      );
      if (findResult) {
        return formatDynamicSelectUIOption(option, findResult.data, findResult.context, dataRoot);
      }
    } else {
      // Static option
      if (dataModelEqualsToUnknown(dataModel, option.value)) {
        return {label: option.label, value: option.value.toString(), data: dataModel};
      }
    }
  }
  return {isInvalid: true, data: dataModel};
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
  root: DataModelRoot,
): DataModel | undefined {
  if (input === null) {
    return nullDataModel;
  }
  const valueDataModel = dataSchemaIsString(schema.dataSchema)
    ? stringToDataModel(input)
    : stringToNumberDataModel(input);
  if (valueDataModel === undefined) {
    return undefined;
  }
  for (const option of schema.options) {
    if (option.label === undefined) {
      // Dynamic option
      const findResult = findDataModel(
        undefined,
        // TODO matcherは暫定対応なので、後でちゃんと実装する
        {path: option.path, matcher: {type: 'equal', operand1: option.valuePath, operand2: valueDataModel}},
        dataContext,
        root,
      );
      if (findResult) {
        return valueDataModel;
      }
    } else {
      // Static option
      if (dataModelEqualsToUnknown(valueDataModel, option.value)) {
        return valueDataModel;
      }
    }
  }
  return undefined;
}

export function selectUIModelCurrentLabel(current: SelectUIModelCurrentValue | undefined): string | undefined {
  if (current?.isInvalid) {
    return dataModelToLabelString(current?.data);
  } else {
    return current?.label;
  }
}
