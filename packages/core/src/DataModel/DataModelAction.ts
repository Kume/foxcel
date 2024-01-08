import {dataPathLength, EditingForwardDataPath} from './DataPath';
import {DataModel, DataPointer} from './DataModelTypes';
import {
  DataPathContainer,
  deleteFromDataModel,
  insertToDataModel2,
  pushToDataModel,
  setKeyToDataModel2,
  setToDataModel2,
} from './DataModel';
import {DataSchemaContext, DataSchemaExcludeRecursive} from './DataSchema';
import {DataModelContext, DataModelRoot} from './DataModelContext';

export interface PushDataModelAction {
  readonly type: 'push';
  readonly path: EditingForwardDataPath;
  readonly data: DataModel;
  readonly key?: string | null;
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly path: EditingForwardDataPath;
  readonly data: DataModel;
}

export interface SetKeyDataModelAction {
  readonly type: 'setKey';
  readonly path: EditingForwardDataPath;
  readonly key: string | null;
  readonly mapIndex: number;
}

export interface InsertDataModelAction {
  readonly type: 'insert';
  readonly path: EditingForwardDataPath;
  readonly data: DataModel;

  /**
   * undefinedの場合、先頭に要素を挿入する
   */
  readonly after: DataPointer | undefined;
}

export interface DeleteDataModelAction {
  readonly type: 'delete';
  readonly at?: DataPointer;
  readonly path: EditingForwardDataPath;
}

export type DataModelAction =
  | PushDataModelAction
  | SetDataModelAction
  | SetKeyDataModelAction
  | InsertDataModelAction
  | DeleteDataModelAction;

export function applyDataModelAction(root: DataModelRoot, action: DataModelAction): DataModel | undefined {
  const context = DataModelContext.createRoot(root);
  switch (action.type) {
    case 'set':
      if (dataPathLength(action.path) === 0) {
        return action.data;
      } else {
        return setToDataModel2(DataPathContainer.create(action.path), context, {model: action.data});
      }

    case 'setKey': {
      return setKeyToDataModel2(DataPathContainer.create(action.path), context, {
        key: action.key,
        mapIndex: action.mapIndex,
      });
    }

    case 'insert':
      return insertToDataModel2(DataPathContainer.create(action.path), context, {
        after: action.after,
        model: action.data,
      });

    case 'push':
      return model === undefined
        ? undefined
        : pushToDataModel(action.path, action.data, model, schemaContext, action.key ?? undefined);

    case 'delete':
      return model === undefined ? undefined : deleteFromDataModel(action.path, action.at, model, schemaContext);
  }
}

export function applyDataModelActions(root: DataModelRoot, actions: DataModelAction[]): DataModel | undefined {
  return actions.reduce(
    (prevModel, action) => applyDataModelAction({model: prevModel, schema: root.schema}, action),
    root.model,
  );
}
