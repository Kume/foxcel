import {UIModel} from '../UIModel/UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {ForwardDataPath} from '../DataModel/DataPath';
import {logDataFocus, logSchemaFocus, UIDataFocusLogNode, UISchemaFocusLogNode} from '../UIModel/UIModelFocus';
import {DataModelAction, applyDataModelAction} from '../DataModel/DataModelAction';
import {buildUIModel} from '../UIModel/UIModel';
import {UISchemaContext} from '../UIModel/UISchemaContext';
import {UISchema} from '../UIModel/UISchemaTypes';
import {DataSchemaExcludeRecursive} from '../DataModel/DataSchema';
import {nullDataModel} from '../DataModel/DataModel';
import {UISchemaExcludeRecursive} from '../UIModel/UISchema';
import {emptyDataModelContext} from '../DataModel/DataModelContext';

export interface AppState {
  data: DataModel;
  uiModel: UIModel;
  uiSchema: UISchema;
  dataSchema: DataSchemaExcludeRecursive;
  rootUISchemaContext: UISchemaContext;
  focus?: ForwardDataPath;
  schemaFocusLog?: UISchemaFocusLogNode;
  dataFocusLog?: UIDataFocusLogNode;
}

export interface AppFocusAction {
  readonly type: 'focus';
  readonly path: ForwardDataPath;
}

export interface AppInitializeAction {
  readonly type: 'init';
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly dataSchema: DataSchemaExcludeRecursive;
  readonly data: DataModel | undefined;
}

export interface AppDataModelAction {
  readonly type: 'data';
  readonly action: DataModelAction;
}

export interface AppBatchAction {
  readonly type: 'batch';
  readonly actions: AppAction[];
}

export type AppAction = AppInitializeAction | AppFocusAction | AppDataModelAction | AppBatchAction;

export function applyAppActionToState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'init': {
      const data = action.data ?? nullDataModel;
      const rootSchemaContext = UISchemaContext.createRootContext(action.uiSchema);
      const uiModel = buildUIModel(
        rootSchemaContext,
        data,
        undefined,
        undefined,
        emptyDataModelContext,
        {model: data, schema: action.dataSchema},
        undefined,
        undefined,
        undefined,
      );
      return {
        data,
        uiSchema: action.uiSchema,
        dataSchema: action.dataSchema,
        rootUISchemaContext: rootSchemaContext,
        uiModel,
      };
    }
    case 'focus': {
      const uiModel = buildUIModel(
        state.rootUISchemaContext,
        state.data,
        state.uiModel,
        undefined,
        emptyDataModelContext,
        {model: state.data, schema: state.rootUISchemaContext.rootSchema.dataSchema},
        action.path,
        state.dataFocusLog,
        state.schemaFocusLog,
      );
      return {
        ...state,
        focus: action.path,
        uiModel,
        schemaFocusLog: logSchemaFocus(uiModel, state.rootUISchemaContext, state.schemaFocusLog),
        dataFocusLog: logDataFocus(uiModel, state.rootUISchemaContext, state.dataFocusLog),
      };
    }
    case 'data': {
      const data = applyDataModelAction(state.data, state.dataSchema, action.action);
      if (!data) {
        return state;
      }
      const focus = undefined; // TODO actionからDataPathを取得してセットする
      const uiModel = buildUIModel(
        state.rootUISchemaContext,
        data,
        state.uiModel,
        undefined,
        emptyDataModelContext,
        {model: state.data, schema: state.rootUISchemaContext.rootSchema.dataSchema},
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
      };
    }
    case 'batch': {
      let currentState = state;
      for (const innerAction of action.actions) {
        currentState = applyAppActionToState(currentState, innerAction);
      }
      return currentState;
    }
  }
}
