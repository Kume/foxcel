import {DataModel} from './DataModelTypes';
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
  readonly after?: number;
}

export interface InsertDataValuesModelAction {
  readonly type: 'insertValues';
  readonly dataContext: SerializedDataModelContext;
  readonly data: readonly DataModel[];

  /**
   * undefinedの場合、先頭に要素を挿入する
   */
  readonly after?: number;
}

export interface DeleteDataModelAction {
  readonly type: 'delete';
  readonly at?: number | readonly number[];
  readonly dataContext: SerializedDataModelContext;
}

export type DataModelAction =
  | PushDataModelAction
  | SetDataModelAction
  | SetKeyDataModelAction
  | InsertDataModelAction
  | InsertDataValuesModelAction
  | DeleteDataModelAction;

export function applyDataModelAction(root: DataModelRoot, action: DataModelAction): DataModel | undefined {
  const context = DataModelContext.createRoot(root);
  switch (action.type) {
    case 'set':
      return setToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        model: action.data,
      });

    case 'setKey':
      return setKeyToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        key: action.key,
      });

    case 'insert':
      return insertToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        after: action.after,
        model: action.data,
      });

    case 'insertValues':
      return insertToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        after: action.after,
        models: action.data,
      });

    case 'push':
      return pushToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        model: action.data,
        key: action.key ?? undefined,
      });

    case 'delete':
      return deleteFromDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        at: action.at,
      });
  }
}

export function applyDataModelActions(root: DataModelRoot, actions: DataModelAction[]): DataModel | undefined {
  return actions.reduce(
    (prevModel, action) => applyDataModelAction({model: prevModel, schema: root.schema}, action),
    root.model,
  );
}
