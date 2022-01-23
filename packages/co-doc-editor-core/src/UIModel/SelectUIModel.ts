import {SelectUIModel} from './UIModelTypes';
import {AppAction} from '../App/AppState';
import {DataModel} from '../DataModel/DataModelTypes';
import {nullDataModel, unknownToDataModel} from '../DataModel/DataModel';

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
