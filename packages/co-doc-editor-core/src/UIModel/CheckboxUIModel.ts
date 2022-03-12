import {CheckboxUIModel} from './UIModelTypes';
import {booleanDataModelToBoolean, booleanToDataModel} from '../DataModel/DataModel';
import {AppAction} from '../App/AppState';

export function checkboxUIModelValue(model: CheckboxUIModel): boolean {
  return model.data === undefined ? false : booleanDataModelToBoolean(model.data);
}

export function selectUIModelSetValue(value: boolean, model: CheckboxUIModel): AppAction {
  return {
    type: 'data',
    action: {type: 'set', path: model.dataPath, data: booleanToDataModel(value)},
  };
}
