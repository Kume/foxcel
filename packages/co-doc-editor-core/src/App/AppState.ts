import {UIModel} from '../UIModel/UIModelTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {emptyDataPath, ForwardDataPath} from '../DataModel/DataPath';
import {logDataFocus, logSchemaFocus, UIDataFocusLogNode, UISchemaFocusLogNode} from '../UIModel/UIModelFocus';
import {DataModelAction, applyDataModelAction} from '../DataModel/DataModelAction';
import {buildUIModel} from '../UIModel/UIModel';
import {UISchemaContext} from '../UIModel/UISchemaContext';
import {UISchema} from '../UIModel/UISchemaTypes';
import {DataSchemaExcludeRecursive} from '../DataModel/DataSchema';

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

export interface AppDataModelAction {
  readonly type: 'data';
  readonly action: DataModelAction;
}

export type AppAction = AppFocusAction | AppDataModelAction;

export function applyAppActionToState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'focus': {
      const uiModel = buildUIModel(
        state.rootUISchemaContext,
        state.data,
        undefined,
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
        undefined,
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
  }
}
