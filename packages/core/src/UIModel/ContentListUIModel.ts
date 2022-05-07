import {AppAction} from '../App/AppState';
import {ContentListUIModel} from './UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {defaultDataModelForSchema} from '../DataModel/DataModelWithSchema';

function initialData(model: ContentListUIModel): DataModel {
  // このdataSchemaにrecursiveは入ってはいけないのでは？
  // => いや、contentのschemaだからありうる。そうすると、そのスキーマ情報を解決するためにDataSchemaContextが必要になるか？
  // => modelにデフォルトデータをセットしとくのが良いかも？
  return defaultDataModelForSchema(model.schema.content.dataSchema);
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
      after: model.indexes[index]?.pointer,
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
