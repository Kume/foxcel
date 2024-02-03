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
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly dataContext: SerializedDataModelContext;
  readonly data: DataModel;
}

export interface SetMultipleDataAction {
  readonly type: 'multiSet';
  readonly dataContext: SerializedDataModelContext;
  readonly setActions?: readonly SetMultipleDataChildSetAction[];
  readonly setKeyActions?: readonly SetMultipleDataChildSetKeyAction[];
  readonly deleteActions?: readonly SetMultipleDataChildDeleteAction[];
}

export interface BatchDataAction {
  readonly type: 'batch';
  readonly setMultiple?: SetMultipleDataAction;
  readonly push?: PushDataModelAction | PushValuesDataModelAction;
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
  | SetMultipleDataAction
  | BatchDataAction;

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

    case 'pushValues':
      return pushToDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        models: action.data,
      });

    case 'delete':
      return deleteFromDataModel(root.model, DataModelContextPathContainer.create(action.dataContext), context, {
        at: action.at,
      });

    case 'multiSet':
      return setToDataModelRecursive(
        root.model,
        DataModelContextPathContainer.create(action.dataContext),
        context,
        setMultipleDataActionToParams(action),
      );

    case 'batch': {
      const tmpData = action.setMultiple
        ? setToDataModelRecursive(
            root.model,
            DataModelContextPathContainer.create(action.setMultiple.dataContext),
            context,
            setMultipleDataActionToParams(action.setMultiple),
          )
        : root.model;
      switch (action.push?.type) {
        case 'push':
          return pushToDataModel(tmpData, DataModelContextPathContainer.create(action.push.dataContext), context, {
            model: action.push.data,
            key: action.push.key ?? undefined,
          });
        case 'pushValues':
          return pushToDataModel(tmpData, DataModelContextPathContainer.create(action.push.dataContext), context, {
            models: action.push.data,
          });
        case undefined:
          return tmpData;
      }
    }
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
  dataContext: SerializedDataModelContext,
  actions: readonly DataModelAtomicAction[],
): SetMultipleDataAction | undefined {
  let setActions: SetMultipleDataChildSetAction[] | undefined;
  let setKeyActions: SetMultipleDataChildSetKeyAction[] | undefined;
  let deleteActions: SetMultipleDataChildDeleteAction[] | undefined;

  for (const action of actions) {
    switch (action.type) {
      case 'set':
        setActions = setActions ?? [];
        setActions.push({
          path: relativeSerializedDataModelContextPath(action.dataContext, dataContext),
          data: action.data,
        });
        break;

      case 'setKey':
        setKeyActions = setKeyActions ?? [];
        setKeyActions.push({
          path: relativeSerializedDataModelContextPath(action.dataContext, dataContext),
          key: action.key,
        });
        break;

      case 'delete':
        deleteActions = deleteActions ?? [];
        deleteActions.push({path: relativeSerializedDataModelContextPath(action.dataContext, dataContext)});
        break;
    }
  }

  return setActions || setKeyActions || deleteActions
    ? {type: 'multiSet', dataContext, setActions, setKeyActions, deleteActions}
    : undefined;
}
