import {DataModel} from './DataModelTypes';
import {
  deleteFromDataModel,
  insertToDataModel,
  pushToDataModel,
  SetDataRecursiveParams,
  setKeyToDataModel,
  setToDataModel,
  setToDataModelRecursive,
} from './DataModel';
import {
  DataModelContext,
  DataModelContextPathContainer,
  DataModelRoot,
  RelativeDataModelContextPath,
  relativeSerializedDataModelContextPath,
  SerializedDataModelContext,
} from './DataModelContext';

export interface PushDataModelAction {
  readonly type: 'push';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;
  readonly key?: string | null;
}

export interface PushValuesDataModelAction {
  readonly type: 'pushValues';
  readonly dataContext: SerializedDataModelContext;
  readonly data: readonly {readonly value: DataModel; readonly key?: string}[];
  readonly key?: string | null;
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;
}

interface SetMultipleDataActionNode {
  readonly setActions?: readonly SetMultipleDataChildSetAction[];
  readonly setKeyActions?: readonly SetMultipleDataChildSetKeyAction[];
  readonly deleteActions?: readonly SetMultipleDataChildDeleteAction[];
  readonly children?: SetMultipleDataActionChild[];
}

export interface SetMultipleDataAction extends SetMultipleDataActionNode {
  readonly type: 'multiSet';
  readonly dataContext: SerializedDataModelContext;
  readonly setActions?: readonly SetMultipleDataChildSetAction[];
  readonly setKeyActions?: readonly SetMultipleDataChildSetKeyAction[];
  readonly deleteActions?: readonly SetMultipleDataChildDeleteAction[];
}

export interface BatchDataAction {
  readonly type: 'batch';
  readonly setMultiple?: SetMultipleDataAction;
  readonly push?: PushDataModelAction;
}

export interface SetMultipleDataChildSetAction {
  readonly path: RelativeDataModelContextPath;
  readonly data: DataModel;
}

export interface SetMultipleDataChildSetKeyAction {
  readonly path: RelativeDataModelContextPath;
  readonly key: string | null;
}

export interface SetMultipleDataChildDeleteAction {
  readonly path: RelativeDataModelContextPath;
  readonly at?: number | readonly number[];
}

export interface SetMultipleDataActionChild extends SetMultipleDataActionNode {
  readonly path: RelativeDataModelContextPath;
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

export type DataModelAtomicAction = SetDataModelAction | SetKeyDataModelAction | DeleteDataModelAction;

export type DataModelAction =
  | DataModelAtomicAction
  | PushDataModelAction
  | PushValuesDataModelAction
  | InsertDataModelAction
  | InsertDataValuesModelAction
  | SetMultipleDataAction;

export function applyDataModelAction(root: DataModelRoot, action: DataModelAction): DataModel | undefined {
  const context = DataModelContext.createRoot(root);
  const path = DataModelContextPathContainer.create(action.dataContext);
  switch (action.type) {
    case 'set':
      return setToDataModel(root.model, path, context, {
        model: action.data,
      });

    case 'setKey':
      return setKeyToDataModel(root.model, path, context, {
        key: action.key,
      });

    case 'insert':
      return insertToDataModel(root.model, path, context, {
        after: action.after,
        model: action.data,
      });

    case 'insertValues':
      return insertToDataModel(root.model, path, context, {
        after: action.after,
        models: action.data,
      });

    case 'push':
      return pushToDataModel(root.model, path, context, {
        model: action.data,
        key: action.key ?? undefined,
      });

    case 'pushValues':
      return pushToDataModel(root.model, path, context, {models: action.data, key: action.key ?? undefined});

    case 'delete':
      return deleteFromDataModel(root.model, path, context, {
        at: action.at,
      });

    case 'multiSet':
      return setToDataModelRecursive(root.model, path, context, setMultipleDataActionToParams(action));
  }
}

export function applyDataModelActions(root: DataModelRoot, actions: DataModelAction[]): DataModel | undefined {
  return actions.reduce(
    (prevModel, action) => applyDataModelAction({model: prevModel, schema: root.schema}, action),
    root.model,
  );
}

function setMultipleDataActionToParams(action: SetMultipleDataAction): SetDataRecursiveParams {
  return {
    setActions: action.setActions?.map(({path, data}) => ({
      path: DataModelContextPathContainer.create(path),
      params: {model: data},
    })),
    setKeyActions: action.setKeyActions?.map(({path, key}) => ({
      path: DataModelContextPathContainer.create(path),
      params: {key},
    })),
    deleteActions: action.deleteActions?.map(({path, at}) => ({
      path: DataModelContextPathContainer.create(path),
      params: {at},
    })),
  };
}

export function buildMultiSetDataModelActionNode(
  baseContext: SerializedDataModelContext,
  actions: readonly DataModelAtomicAction[],
): SetMultipleDataActionNode | undefined {
  let setActions: SetMultipleDataChildSetAction[] | undefined;
  let setKeyActions: SetMultipleDataChildSetKeyAction[] | undefined;
  let deleteActions: SetMultipleDataChildDeleteAction[] | undefined;

  for (const action of actions) {
    switch (action.type) {
      case 'set':
        setActions = setActions ?? [];
        setActions.push({
          path: relativeSerializedDataModelContextPath(baseContext, action.dataContext),
          data: action.data,
        });
        break;

      case 'setKey':
        setKeyActions = setKeyActions ?? [];
        setKeyActions.push({
          path: relativeSerializedDataModelContextPath(baseContext, action.dataContext),
          key: action.key,
        });
        break;

      case 'delete':
        deleteActions = deleteActions ?? [];
        deleteActions.push({path: relativeSerializedDataModelContextPath(baseContext, action.dataContext)});
        break;
    }
  }

  return setActions || setKeyActions || deleteActions ? {setActions, setKeyActions, deleteActions} : undefined;
}
