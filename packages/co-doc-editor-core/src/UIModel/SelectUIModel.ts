import {SelectUIModel} from './UIModelTypes';
import {AppAction} from '../App/AppState';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  dataModelEqualsToUnknown,
  dataModelToString,
  nullDataModel,
  stringToDataModel,
  stringToNumberDataModel,
  unknownToDataModel,
} from '../DataModel/DataModel';
import {collectDataModel2} from '../DataModel/DataModelCollector';
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
  return getSelectUIOptionsImpl(model.schema, model.data, model.dataContext, root);
}

function getSelectUIOptionsImpl(
  schema: SelectUISchema,
  data: DataModel | undefined,
  dataContext: DataModelContext,
  root: DataModelRoot,
): SelectUIOption[] {
  const options: SelectUIOption[] = [];

  for (const optionSchema of schema.options) {
    if (optionSchema.label === undefined) {
      // Dynamic option
      const collectResults = collectDataModel2(data, optionSchema.path, dataContext, root);
      for (const {data, context} of collectResults) {
        options.push(formatDynamicSelectUIOption(optionSchema, data, context, root));
      }
    } else {
      // Static option
      options.push({
        label: optionSchema.label,
        value: optionSchema.value.toString(),
        data: unknownToDataModel(optionSchema.value),
      });
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

export function selectUIModelDefaultOptions(model: SelectUIModel): SelectUIOption[] {
  return model.current ? [model.current] : [];
}

export function selectUIModelSetValue(model: SelectUIModel, value: SelectUIOption | null): AppAction {
  return {
    type: 'data',
    action: {
      type: 'set',
      path: model.dataPath,
      data: value === null ? nullDataModel : value.data,
    },
  };
}

export function selectUIModelSetString(
  model: SelectUIModel,
  value: string,
  root: DataModelRoot,
): AppAction | undefined {
  const resultData = selectUIModelHandleInputForSchema(model.schema, value, model.dataContext, root);
  return resultData === undefined
    ? undefined
    : {type: 'data', action: {type: 'set', path: model.dataPath, data: resultData}};
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

export function filterSelectUIOptionsByText(options: readonly SelectUIOption[], text: string): SelectUIOption[] {
  return options.filter(
    ({label, value}) =>
      label.toLocaleLowerCase().indexOf(text.toLocaleLowerCase()) >= 0 ||
      value.toLocaleLowerCase().indexOf(text.toLocaleLowerCase()) >= 0,
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
        {} as any, // TODO ちゃんとログの仕組みを整える
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
