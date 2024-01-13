import {AppAction} from '../App/AppState';
import {nullDataModel, numberDataModelToNumber, numberToIntegerDataModel} from '../DataModel/DataModel';
import {NumberUIModel} from './UIModelTypes';
import {NumberUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';

export function numberUIModelSetText(model: NumberUIModel, textValue: string): AppAction | undefined {
  const dataModel = stringToDataModel(textValue);
  return dataModel !== undefined
    ? {type: 'data', action: {type: 'set', dataContext: model.dataContext, data: dataModel}}
    : undefined;
}

function stringToDataModel(textValue: string): DataModel | undefined {
  if (textValue === '') {
    return nullDataModel;
  }
  const value = Number(textValue);
  return Number.isFinite(value) ? numberToIntegerDataModel(value) : undefined;
}

export function numberUIModelDisplayText(model: NumberUIModel): string {
  return model.data === undefined ? '' : numberDataModelToNumber(model.data).toString();
}

export function numberUIModelHandleInputForSchema(schema: NumberUISchema, input: string | null): DataModel | undefined {
  return input === null ? nullDataModel : stringToDataModel(input);
}
