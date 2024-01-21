import {CheckboxUIModel} from './UIModelTypes';
import {
  booleanDataModelToBoolean,
  booleanToDataModel,
  falseDataModel,
  nullDataModel,
  trueDataModel,
} from '../DataModel/DataModel';
import {AppAction} from '../App/AppState';
import {CheckBoxUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';

export function checkboxUIModelValue(model: CheckboxUIModel): boolean {
  return model.data === undefined ? false : booleanDataModelToBoolean(model.data);
}

export function checkboxUIModelSetValue(model: CheckboxUIModel, value: boolean): AppAction {
  return {
    type: 'data',
    action: {type: 'set', dataContext: model.dataContext, data: booleanToDataModel(value)},
  };
}

export function checkboxUIModelSetStringValue(model: CheckboxUIModel, value: string): AppAction | undefined {
  const dataModel = stringToDataModel(value);
  return dataModel === undefined
    ? undefined
    : {type: 'data', action: {type: 'set', dataContext: model.dataContext, data: dataModel}};
}

function stringToDataModel(value: string | null): DataModel | undefined {
  if (value === null) {
    return nullDataModel;
  }
  const upperValue = value.toUpperCase();
  switch (upperValue) {
    case 'TRUE':
      return trueDataModel;
    case 'FALSE':
      return falseDataModel;
  }
  return undefined;
}

export function checkboxUIModelHandleInputWithSchema(
  schema: CheckBoxUISchema,
  input: string | null,
): DataModel | undefined {
  return stringToDataModel(input);
}
