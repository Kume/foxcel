import {dataPathLength, ForwardDataPath} from './DataPath';
import {DataModel, DataPointer} from './DataModelTypes';
import {deleteFromDataModel, insertToDataModel, pushToDataModel, setKeyToDataModel, setToDataModel} from './DataModel';
import {DataSchemaContext, DataSchemaExcludeRecursive} from './DataSchema';

export interface PushDataModelAction {
  readonly type: 'push';
  readonly path: ForwardDataPath;
  readonly data: DataModel;
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly path: ForwardDataPath;
  readonly data: DataModel;
}

export interface SetKeyDataModelAction {
  readonly type: 'setKey';
  readonly path: ForwardDataPath;
  readonly key: string | null;
  readonly sourceKeyPointer: DataPointer;
}

export interface InsertDataModelAction {
  readonly type: 'insert';
  readonly path: ForwardDataPath;
  readonly data: DataModel;

  /**
   * undefinedの場合、先頭に要素を挿入する
   */
  readonly after: DataPointer | undefined;
}

export interface DeleteDataModelAction {
  readonly type: 'delete';
  readonly at: DataPointer;
  readonly path: ForwardDataPath;
}

export type DataModelAction =
  | PushDataModelAction
  | SetDataModelAction
  | SetKeyDataModelAction
  | InsertDataModelAction
  | DeleteDataModelAction;

export function applyDataModelAction(
  model: DataModel | undefined,
  schema: DataSchemaExcludeRecursive | undefined,
  action: DataModelAction,
): DataModel | undefined {
  const schemaContext = schema && DataSchemaContext.createRootContext(schema);
  switch (action.type) {
    case 'set':
      if (dataPathLength(action.path) === 0) {
        return action.data;
      } else {
        return model === undefined ? undefined : setToDataModel(action.path, action.data, model, schemaContext);
      }

    case 'setKey': {
      return model === undefined
        ? undefined
        : setKeyToDataModel(action.path, action.sourceKeyPointer, action.key, model, schemaContext);
    }

    case 'insert':
      return model === undefined
        ? undefined
        : insertToDataModel(action.path, action.after, action.data, model, schemaContext);

    case 'push':
      return model === undefined ? undefined : pushToDataModel(action.path, action.data, model, schemaContext);

    case 'delete':
      return model === undefined ? undefined : deleteFromDataModel(action.path, action.at, model, schemaContext);
  }
}
