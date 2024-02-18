import {AppAction} from '../App/AppState';
import {ContentListUIModel} from './UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {defaultDataModelForSchema} from '../DataModel/DataModelWithSchema';
import {insertToDataModel} from '../DataModel/DataModel';
import {DataModelContext} from '../DataModel/DataModelContext';

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
      after: index === 0 ? undefined : index - 1,
      data: initialContentData(model),
    },
  };
}

export function contentListAddAfterAction(model: ContentListUIModel, index: number): AppAction {
  if (model.data === undefined) {
    const emptyData = initialData(model);
    const initial = insertToDataModel(
      emptyData,
      undefined,
      DataModelContext.createRoot({model: emptyData, schema: model.schema.dataSchema}),
      {model: initialContentData(model)},
    );
    return {
      type: 'data',
      action: {type: 'set', dataContext: model.dataContext, data: initial ?? emptyData},
    };
  } else {
    return {
      type: 'data',
      action: {
        type: 'insert',
        dataContext: model.dataContext,
        after: index,
        data: initialContentData(model),
      },
    };
  }
}

export function contentListRemoveAtAction(model: ContentListUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'delete',
      dataContext: model.dataContext,
      at: index,
    },
  };
}
