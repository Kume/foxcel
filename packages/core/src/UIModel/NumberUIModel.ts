import {AppDataModelAction} from '../App/AppState';
import {dataModelEquals, numberDataModelToNumber, numberToIntegerDataModel} from '../DataModel/DataModel';
import {NumberUIModel} from './UIModelTypes';
import {NumberUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {DataModelAtomicAction} from '../DataModel/DataModelAction';

export function numberUIModelSetText(model: NumberUIModel, textValue: string) {
  const dataAction = numberUIModelDataActionForValue(model, textValue);
  return dataAction && ({type: 'data', action: dataAction} as const satisfies AppDataModelAction);
}

export function numberUIModelDataActionForValue(
  model: NumberUIModel,
  textValue: string,
): DataModelAtomicAction | undefined {
  const dataModel = stringToDataModel(textValue);
  return dataModel === undefined
    ? model.data === undefined
      ? undefined
      : {type: 'delete', dataContext: model.dataContext}
    : dataModelEquals(model.data, dataModel)
    ? undefined
    : {type: 'set', dataContext: model.dataContext, data: dataModel};
}

function stringToDataModel(textValue: string): DataModel | undefined {
  if (textValue === '') {
    return undefined;
  }
  const value = Number(textValue);
  return Number.isFinite(value) ? numberToIntegerDataModel(value) : undefined;
}

export function numberUIModelDisplayText(model: NumberUIModel): string {
  return model.data === undefined ? '' : numberDataModelToNumber(model.data).toString();
}

export function numberUIModelHandleInputForSchema(schema: NumberUISchema, input: string | null): DataModel | undefined {
  return input === null ? undefined : stringToDataModel(input);
}
