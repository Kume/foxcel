import {AppAction} from '../App/AppState';
import {TextUIModel} from './UIModelTypes';
import {unknownToDataModel} from '../DataModel/DataModel';

export function textUIModelSetText(model: TextUIModel, value: string | null): AppAction {
  return {
    type: 'data',
    action: model.isKey
      ? {type: 'setKey', path: model.parentDataPath, sourceKeyPointer: model.selfPointer, key: value || null}
      : {type: 'set', path: model.dataPath, data: unknownToDataModel(value)},
  };
}
