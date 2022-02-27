import {SelectUIModel} from './UIModelTypes';
import {AppAction} from '../App/AppState';
import {DataModel} from '../DataModel/DataModelTypes';
import {dataModelToString, nullDataModel, unknownToDataModel} from '../DataModel/DataModel';
import {collectDataModel2} from '../DataModel/DataModelCollector';
import {DataModelContext} from '../DataModel/DataModelContext';
import {fillTemplateLineAndToString} from '../DataModel/TemplateEngine';
import {SelectDynamicOptionSchema} from '../DataModel/DataSchema';

export interface SelectUIOption {
  readonly label: string;
  readonly value: string;
  readonly data: DataModel;
}

export function getSelectUIOptions(model: SelectUIModel): SelectUIOption[] {
  const options: SelectUIOption[] = [];

  for (const optionSchema of model.schema.options) {
    if (optionSchema.label === undefined) {
      // Dynamic option
      const collectResults = collectDataModel2(model.data, optionSchema.path, model.dataContext);
      for (const {data, context} of collectResults) {
        options.push(formatDynamicSelectUIOption(optionSchema, data, context));
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

export function formatDynamicSelectUIOption(
  option: SelectDynamicOptionSchema,
  data: DataModel,
  context: DataModelContext,
): SelectUIOption {
  const stringValue = dataModelToString(data);
  return {
    label: option.labelTemplate ? fillTemplateLineAndToString(option.labelTemplate, data, context) : stringValue,
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
