import {DataModel, DataPointer} from './DataModelTypes';
import {deleteFromDataModel, insertToDataModel, pushToDataModel, setKeyToDataModel, setToDataModel} from './DataModel';
import {
  DataModelContext,
  DataModelContextPathContainer,
  DataModelRoot,
  SerializedDataModelContext,
} from './DataModelContext';

export interface PushDataModelAction {
  readonly type: 'push';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;
  readonly key?: string | null;
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;
}

export interface SetKeyDataModelAction {
  readonly type: 'setKey';
  readonly dataContext: SerializedDataModelContext;
  readonly key: string | null;
}

export interface InsertDataModelAction {
  readonly type: 'insert';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;

  /**
   * undefinedの場合、先頭に要素を挿入する
   */
  readonly after: DataPointer | undefined;
}

export interface DeleteDataModelAction {
  readonly type: 'delete';
  readonly at?: DataPointer;
  readonly dataContext: SerializedDataModelContext;
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
      return setToDataModel(DataModelContextPathContainer.create(action.dataContext), context, {model: action.data});

    case 'setKey':
      return setKeyToDataModel(DataModelContextPathContainer.create(action.dataContext), context, {key: action.key});

    case 'insert':
      return insertToDataModel(DataModelContextPathContainer.create(action.dataContext), context, {
        after: action.after,
        model: action.data,
      });

    case 'push':
      return pushToDataModel(DataModelContextPathContainer.create(action.dataContext), context, {
        model: action.data,
        key: action.key ?? undefined,
      });

    case 'delete':
      return deleteFromDataModel(DataModelContextPathContainer.create(action.dataContext), context, {at: action.at});
  }
}

export function applyDataModelActions(root: DataModelRoot, actions: DataModelAction[]): DataModel | undefined {
  return actions.reduce(
    (prevModel, action) => applyDataModelAction({model: prevModel, schema: root.schema}, action),
    root.model,
  );
}
