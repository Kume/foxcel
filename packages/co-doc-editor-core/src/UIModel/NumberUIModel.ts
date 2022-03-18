import {AppAction} from '../App/AppState';
import {numberDataModelToNumber, numberToIntegerDataModel} from '../DataModel/DataModel';
import {NumberUIModel} from './UIModelTypes';

export function numberUIModelSetText(model: NumberUIModel, textValue: string): AppAction | undefined {
  const value = Number(textValue);
  return Number.isFinite(value)
    ? {type: 'data', action: {type: 'set', path: model.dataPath, data: numberToIntegerDataModel(value)}}
    : undefined;
}

export function numberUIModelDisplayText(model: NumberUIModel): string {
  return model.data === undefined ? '' : numberDataModelToNumber(model.data).toString();
}
