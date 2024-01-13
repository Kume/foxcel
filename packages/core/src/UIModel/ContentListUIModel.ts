import {AppAction} from '../App/AppState';
import {ContentListUIModel} from './UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {defaultDataModelForSchema} from '../DataModel/DataModelWithSchema';

function initialContentData(model: ContentListUIModel): DataModel {
  // TODO このdataSchemaにrecursiveは入ってはいけないのでは？
  // => いや、contentのschemaだからありうる。そうすると、そのスキーマ情報を解決するためにDataSchemaContextが必要になるか？
  // => modelにデフォルトデータをセットしとくのが良いかも？
  // @ts-expect-error
  return defaultDataModelForSchema(model.schema.content.dataSchema);
}

function initialData(model: ContentListUIModel): DataModel {
  return defaultDataModelForSchema(model.schema.dataSchema);
}

export function contentListAddBeforeAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      dataContext: model.dataContext,
      after: index === 0 ? undefined : model.indexes[index - 1].pointer,
      data: initialContentData(model),
    },
  };
}

export function contentListAddAfterAction(model: ContentListUIModel, index: number): AppAction {
  const insertAction: AppAction = {
    type: 'data',
    action: {
      type: 'insert',
      dataContext: model.dataContext,
      after: model.indexes[index]?.pointer,
      data: initialContentData(model),
    },
  };
  if (model.data === undefined) {
    return {
      type: 'batch',
      actions: [
        {
          type: 'data',
          action: {
            type: 'set',
            dataContext: model.dataContext,
            data: initialData(model),
          },
        },
        insertAction,
      ],
    };
  } else {
    return insertAction;
  }
}

export function contentListRemoveAtAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'delete',
      dataContext: model.dataContext,
      at: model.indexes[index].pointer,
    },
  };
}
