import React, {useReducer} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {DataModel, emptyDataPath, ForwardDataPath, unknownToDataModel} from 'co-doc-editor-core';
import {buildSimpleUISchema} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {buildSimpleDataSchema, DataSchemaContext} from 'co-doc-editor-core/dist/DataModel/DataSchema';
import {buildUIModel} from 'co-doc-editor-core/dist/UIModel/UIModel';
import {UISchemaContext} from 'co-doc-editor-core/dist/UIModel/UISchemaContext';
import {DataModelAction, execDataModelAction} from 'co-doc-editor-core/dist/DataModel/DataModelAction';
import {
  logDataFocus,
  logSchemaFocus,
  UIDataFocusLogNode,
  UISchemaFocusLogNode,
} from 'co-doc-editor-core/dist/UIModel/UIModelFocus';
import {sampleConfig} from './sample';

const dataSchema = buildSimpleDataSchema(sampleConfig);
const uiSchema = buildSimpleUISchema(sampleConfig, dataSchema);
const initialDataModel = unknownToDataModel({
  testA: {
    testA_value1: {
      testA1: 'aaa',
      testA2: 'dddd',
      testA3: {
        testA3a: {
          testA3a1: 'testA3a1サンプルデータ',
          testA3a2: 'testA3a2サンプルデータ',
        },
        testA3b: {
          testA3b3: {
            value1: {},
            value2: {},
          },
        },
      },
    },
    testA_value2: {
      testA1: 'aaa2',
      testA3: {
        testA3b: {
          testA3b3: {
            value1: {},
            value2: {},
          },
        },
      },
    },
  },
  testB: {},
});

interface FocusAction {
  readonly type: 'focus';
  readonly path: ForwardDataPath;
}

interface DataAction {
  readonly type: 'data';
  readonly action: DataModelAction;
}

type Action = FocusAction | DataAction;

interface AppState {
  data: DataModel;
  uiModel: UIModel;
  focus?: ForwardDataPath;
  schemaFocusLog?: UISchemaFocusLogNode;
  dataFocusLog?: UIDataFocusLogNode;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'focus': {
      const uiModel = buildUIModel(
        rootSchemaContext,
        state.data,
        emptyDataPath,
        action.path,
        state.dataFocusLog,
        state.schemaFocusLog,
      );
      return {
        ...state,
        focus: action.path,
        uiModel,
        schemaFocusLog: logSchemaFocus(uiModel, rootSchemaContext, state.schemaFocusLog),
        dataFocusLog: logDataFocus(uiModel, rootSchemaContext, state.dataFocusLog),
      };
    }
    case 'data': {
      const data = execDataModelAction(state.data, dataSchema, action.action);
      if (!data) {
        return state;
      }
      const uiModel = buildUIModel(
        rootSchemaContext,
        data,
        emptyDataPath,
        undefined,
        state.dataFocusLog,
        state.schemaFocusLog,
      );
      return {
        data,
        uiModel,
        focus: undefined, // TODO actionからDataPathを取得してセットする
        schemaFocusLog: logSchemaFocus(uiModel, rootSchemaContext, state.schemaFocusLog),
        dataFocusLog: logDataFocus(uiModel, rootSchemaContext, state.dataFocusLog),
      };
    }
  }
}
const rootSchemaContext = UISchemaContext.createRootContext(uiSchema, DataSchemaContext.createRootContext(dataSchema));

function buildInitialState(data: DataModel): AppState {
  const uiModel = buildUIModel(rootSchemaContext, data, emptyDataPath, undefined, undefined, undefined);
  return {data, uiModel};
}

const initialState = buildInitialState(initialDataModel);
export const RootView: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  console.log('root', state);

  return (
    <div>
      <UIView
        model={state.uiModel}
        onChangeData={(action) => dispatch({type: 'data', action})}
        onFocusByDataPath={(path) => dispatch({type: 'focus', path})}
      />
    </div>
  );
};
