import {UIModel} from '../UIModel/UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {logDataFocus, logSchemaFocus, UIDataFocusLogNode, UISchemaFocusLogNode} from '../UIModel/UIModelFocus';
import {applyDataModelAction, DataModelAction} from '../DataModel/DataModelAction';
import {buildUIModel} from '../UIModel/UIModel';
import {UISchemaContext} from '../UIModel/UISchemaContext';
import {UISchemaOrRecursive} from '../UIModel/UISchemaTypes';
import {DataSchemaExcludeRecursive} from '../DataModel/DataSchema';
import {nullDataModel} from '../DataModel/DataModel';
import {UISchemaExcludeRecursive} from '../UIModel/UISchema';
import {
  DataModelContext,
  DataModelContextPathContainer,
  DataModelRoot,
  SerializedDataModelContext,
} from '../DataModel/DataModelContext';

export interface AppState {
  readonly data: DataModel | undefined;
  readonly uiModel: UIModel | undefined;
  readonly uiSchema: UISchemaOrRecursive | undefined;
  readonly dataSchema: DataSchemaExcludeRecursive | undefined;
  readonly rootUISchemaContext: UISchemaContext;
  readonly focus?: SerializedDataModelContext;
  readonly schemaFocusLog?: UISchemaFocusLogNode;
  readonly dataFocusLog?: UIDataFocusLogNode;
  readonly actionHistories: AppActionHistory[];
  readonly forwardActions: AppAction[];
}

export interface AppActionHistory {
  readonly action: AppAction;
  readonly data: DataModel | undefined;
  // TODO UIModelをキャッシュしないなら、全量履歴で保存するとデータ量が多くなる。
  //      逆にキャッシュしないなら保存しておく必要がないはずなので、キャッシュ機能を消す場合はこの項目も消す
  readonly uiModel: UIModel | undefined;
  readonly focus?: SerializedDataModelContext;
  readonly schemaFocusLog?: UISchemaFocusLogNode;
  readonly dataFocusLog?: UIDataFocusLogNode;
}

export interface AppFocusAction {
  readonly type: 'focus';
  readonly dataContext: SerializedDataModelContext;
}

export interface AppInitializeAction {
  readonly type: 'init';
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly dataSchema: DataSchemaExcludeRecursive;
  readonly data: DataModel | undefined;
  readonly restoredActions?: AppAction[];
  readonly restoredForwardActions?: AppAction[];
}

export interface AppDataModelAction {
  readonly type: 'data';
  readonly action: DataModelAction;
}

export interface AppUndoAction {
  readonly type: 'undo';
}

export interface AppRedoAction {
  readonly type: 'redo';
}

export type AppAction = AppInitializeAction | AppFocusAction | AppDataModelAction | AppUndoAction | AppRedoAction;

export const initialAppState: AppState = {
  data: undefined,
  uiModel: undefined,
  uiSchema: undefined,
  dataSchema: undefined,
  // @ts-expect-error undefined許容にするとかなりの量のエラーが出る。本来はundefined許容であるべきな気がする => そもそもclassをstateに入れてるのが間違いっぽい
  rootUISchemaContext: undefined,
  actions: [],
};

export function applyAppActionToState(state: AppState, action: AppAction, disableHistory = false): AppState {
  switch (action.type) {
    case 'init': {
      const data = action.data ?? nullDataModel;
      const rootSchemaContext = UISchemaContext.createRootContext(action.uiSchema);
      const uiModel = buildUIModel(
        rootSchemaContext,
        undefined,
        DataModelContext.createRoot({model: data, schema: action.uiSchema.dataSchema}, false),
        undefined,
        undefined,
        undefined,
      );
      let initializingState: AppState = {
        data,
        uiSchema: action.uiSchema,
        dataSchema: action.dataSchema,
        rootUISchemaContext: rootSchemaContext,
        uiModel,
        actionHistories: [],
        forwardActions: [],
      };

      if (action.restoredActions) {
        for (const restoredAction of action.restoredActions) {
          initializingState = applyAppActionToState(initializingState, restoredAction);
        }
      }

      return initializingState;
    }
    case 'focus': {
      const root: DataModelRoot = {model: state.data, schema: state.rootUISchemaContext.rootSchema.dataSchema};
      const uiModel = buildUIModel(
        state.rootUISchemaContext,
        state.uiModel,
        DataModelContext.createRoot(root, false),
        DataModelContextPathContainer.create(action.dataContext, state.data),
        state.dataFocusLog,
        state.schemaFocusLog,
      );
      return {
        ...state,
        focus: action.dataContext,
        uiModel,
        schemaFocusLog: logSchemaFocus(uiModel, state.rootUISchemaContext, state.schemaFocusLog),
        dataFocusLog: logDataFocus(uiModel, state.rootUISchemaContext, state.dataFocusLog),
        // TODO フォーカスも履歴に保存すべきかは要検討
        actionHistories: disableHistory
          ? state.actionHistories
          : [...state.actionHistories, makeHistory(state, action)],
        forwardActions: disableHistory ? state.forwardActions : [],
      };
    }
    case 'data': {
      if (!state.dataSchema) {
        return state;
      }
      const prevRoot = {model: state.data, schema: state.rootUISchemaContext.rootSchema.dataSchema};
      const data = applyDataModelAction(prevRoot, action.action);
      if (!data) {
        return state;
      }
      const focus = undefined; // TODO actionからDataPathを取得してセットする
      const root = {model: data, schema: state.rootUISchemaContext.rootSchema.dataSchema};
      const uiModel = buildUIModel(
        state.rootUISchemaContext,
        state.uiModel,
        DataModelContext.createRoot(root, false),
        focus,
        state.dataFocusLog,
        state.schemaFocusLog,
      );
      return {
        ...state,
        data,
        uiModel,
        focus,
        schemaFocusLog: logSchemaFocus(uiModel, state.rootUISchemaContext, state.schemaFocusLog),
        dataFocusLog: logDataFocus(uiModel, state.rootUISchemaContext, state.dataFocusLog),
        actionHistories: disableHistory
          ? state.actionHistories
          : [...state.actionHistories, makeHistory(state, action)],
        forwardActions: disableHistory ? state.forwardActions : [],
      };
    }
    case 'undo': {
      if (state.actionHistories.length === 0) {
        return state;
      }

      const lastHistory = state.actionHistories[state.actionHistories.length - 1];
      return {
        ...state,
        data: lastHistory.data,
        uiModel: lastHistory.uiModel,
        focus: lastHistory.focus,
        schemaFocusLog: lastHistory.schemaFocusLog,
        dataFocusLog: lastHistory.dataFocusLog,
        actionHistories: state.actionHistories.slice(0, state.actionHistories.length - 1),
        forwardActions: [...state.forwardActions, lastHistory.action],
      };
    }
    case 'redo': {
      if (state.forwardActions.length === 0) {
        return state;
      }

      const nextAction = state.forwardActions[state.forwardActions.length - 1];
      return {
        ...applyAppActionToState(state, nextAction, true),
        actionHistories: [...state.actionHistories, makeHistory(state, nextAction)],
        forwardActions: state.forwardActions.slice(0, state.forwardActions.length - 1),
      };
    }
  }
}

function makeHistory(state: AppState, action: AppAction): AppActionHistory {
  return {
    action,
    data: state.data,
    uiModel: state.uiModel,
    focus: state.focus,
    schemaFocusLog: state.schemaFocusLog,
    dataFocusLog: state.dataFocusLog,
  };
}
