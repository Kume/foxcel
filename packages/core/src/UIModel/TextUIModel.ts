import {AppAction, AppDataModelAction} from '../App/AppState';
import {TextUIModel} from './UIModelTypes';
import {nullDataModel, stringToDataModel, unknownToDataModel} from '../DataModel/DataModel';
import {TextUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {uiSchemaKeyIsParentKey} from './UISchema';

function formatInput(input: string): string;
function formatInput(input: string | null): string | null;
function formatInput(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  return input.replace(/\r\n/g, '\n').trimEnd();
}

export function textUIModelSetText(model: TextUIModel, value: string | null): AppDataModelAction {
  return {
    type: 'data',
    action: model.isKey
      ? {type: 'setKey', dataContext: model.dataContext, key: formatInput(value) || null}
      : {type: 'set', dataContext: model.dataContext, data: unknownToDataModel(formatInput(value))},
  };
}

type Result = {type: 'key'; key: string | null} | {type: 'value'; value: DataModel};

export function textUIModelHandleInputForSchema(schema: TextUISchema, input: string | null): Result {
  if (uiSchemaKeyIsParentKey(schema.key)) {
    return {type: 'key', key: formatInput(input)};
  } else {
    return {type: 'value', value: input === null ? nullDataModel : stringToDataModel(formatInput(input))};
  }
}
