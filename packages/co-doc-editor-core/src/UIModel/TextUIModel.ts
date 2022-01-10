import {AppAction} from '../App/AppState';
import {TextUIModel} from './UIModelTypes';
import {nullDataModel, stringToDataModel, unknownToDataModel} from '../DataModel/DataModel';
import {TextUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {uiSchemaKeyIsParentKey} from './UISchema';

export function textUIModelSetText(model: TextUIModel, value: string | null): AppAction {
  return {
    type: 'data',
    action: model.isKey
      ? {type: 'setKey', path: model.parentDataPath, sourceKeyPointer: model.selfPointer, key: value || null}
      : {type: 'set', path: model.dataPath, data: unknownToDataModel(value)},
  };
}

type Result = {type: 'key'; key: string | null} | {type: 'value'; value: DataModel};

export function textUIModelHandleInputForSchema(schema: TextUISchema, input: string | null): Result {
  if (uiSchemaKeyIsParentKey(schema.key)) {
    return {type: 'key', key: input};
  } else {
    return {type: 'value', value: input === null ? nullDataModel : stringToDataModel(input)};
  }
}
