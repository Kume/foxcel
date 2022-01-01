import {AppAction} from '../App/AppState';
import {ContentListUIModel} from './UIModelTypes';
import {emptyListModel, emptyMapModel, nullDataModel} from '../DataModel/DataModel';
import {DataModel} from '../DataModel/DataModelTypes';
import {dataSchemaIsList, dataSchemaIsMap} from '../DataModel/DataSchema';

function initialData(model: ContentListUIModel): DataModel {
  const contentDataSchema = model.schema.content.dataSchema;
  if (dataSchemaIsMap(contentDataSchema)) {
    return emptyMapModel;
  } else if (dataSchemaIsList(contentDataSchema)) {
    return emptyListModel;
  } else {
    return nullDataModel;
  }
}

export function contentListAddBeforeAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      path: model.dataPath,
      after: index === 0 ? undefined : model.indexes[index - 1].pointer,
      data: initialData(model),
    },
  };
}

export function contentListAddAfterAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      path: model.dataPath,
      after: model.indexes[index].pointer,
      data: initialData(model),
    },
  };
}

export function contentListRemoveAtAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'delete',
      path: model.dataPath,
      at: model.indexes[index].pointer,
    },
  };
}
