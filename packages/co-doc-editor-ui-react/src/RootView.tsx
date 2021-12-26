import React, {useReducer} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {DataModel, emptyDataPath, ForwardDataPath, RootSchemaConfig, unknownToDataModel} from 'co-doc-editor-core';
import {buildSimpleUISchema} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {buildSimpleDataSchema, DataSchemaContext} from 'co-doc-editor-core/dist/DataModel/DataSchema';
import {buildUIModel} from 'co-doc-editor-core/dist/UIModel/UIModel';
import {UISchemaContext} from 'co-doc-editor-core/dist/UIModel/UISchemaContext';
import {DataModelAction, execDataModelAction} from 'co-doc-editor-core/dist/DataModel/DataModelAction';
import {logSchemaFocus, UIDataFocusLogNode, UISchemaFocusLogNode} from 'co-doc-editor-core/dist/UIModel/UIModelFocus';

const config: RootSchemaConfig = {
  dataSchema: {
    type: 'fixed_map',
    items: {
      testA: {
        type: 'fixed_map',
        label: 'テストA',
        items: {
          testA1: {type: 'string', label: 'てすとA1'},
          testA2: {type: 'string', label: 'テストA2は長めのラベル名'},
          testA3: {
            type: 'fixed_map',
            label: 'テストA3',
            items: {
              testA3a: {
                type: 'fixed_map',
                label: 'テストA3a',
                items: {
                  testA3a1: {type: 'string', label: 'テストA3a1'},
                  testA3a2: {type: 'string', label: 'テストA3a2'},
                },
              },
              testA3b: {
                type: 'fixed_map',
                label: 'テストA3b',
                items: {
                  testA3b1: {type: 'string', label: 'テストA3b1'},
                  testA3b2: {type: 'string', label: 'テストA3b2'},
                },
              },
            },
          },
          testA4: {
            type: 'fixed_map',
            label: 'テストA4',
            items: {
              testA4a: {
                type: 'fixed_map',
                label: 'テストA4a',
                items: {
                  testA4a1: {type: 'string', label: 'テストA4a1'},
                  testA4a2: {type: 'string', label: 'テストA4a2'},
                },
              },
              testA4b: {
                type: 'fixed_map',
                label: 'テストA4b',
                items: {
                  testA4b1: {type: 'string', label: 'テストA4b1'},
                  testA4b2: {type: 'string', label: 'テストA4b2'},
                },
              },
            },
          },
        },
      },
      testB: {
        type: 'fixed_map',
        label: 'テストB',
        items: {
          testB1: {type: 'string', label: 'てすとB1'},
          testB2: {type: 'string', label: 'テストB2'},
        },
      },
    },
  },
  fileMap: {
    children: [],
  },
  uiSchema: {
    type: 'tab',
    key: 'dummy',
    contents: [
      {
        type: 'form',
        key: 'testA',
        contents: [
          {type: 'text', key: 'testA1'},
          {type: 'text', key: 'testA2'},
          {
            type: 'tab',
            key: 'testA3',
            contents: [
              {
                type: 'form',
                key: 'testA3a',
                contents: [
                  {type: 'text', key: 'testA3a1'},
                  {type: 'text', key: 'testA3a2'},
                ],
              },
              {
                type: 'form',
                key: 'testA3b',
                contents: [
                  {type: 'text', key: 'testA3b1'},
                  {type: 'text', key: 'testA3b2'},
                ],
              },
            ],
          },
          {
            type: 'tab',
            key: 'testA4',
            contents: [
              {
                type: 'form',
                key: 'testA4a',
                contents: [
                  {type: 'text', key: 'testA4a1'},
                  {type: 'text', key: 'testA4a2'},
                ],
              },
              {
                type: 'form',
                key: 'testA4b',
                contents: [
                  {type: 'text', key: 'testA4b1'},
                  {type: 'text', key: 'testA4b2'},
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'form',
        key: 'testB',
        contents: [
          {type: 'text', key: 'testB1'},
          {type: 'text', key: 'testB2'},
        ],
      },
    ],
  },
};

const dataSchema = buildSimpleDataSchema(config);
const uiSchema = buildSimpleUISchema(config, dataSchema);
const initialDataModel = unknownToDataModel({
  testA: {
    testA1: 'aaa',
    testA2: 'dddd',
    testA3: {
      testA3a: {
        testA3a1: 'testA3a1サンプルデータ',
        testA3a2: 'testA3a2サンプルデータ',
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
        ...state,
        data,
        uiModel,
        schemaFocusLog: logSchemaFocus(uiModel, rootSchemaContext, state.schemaFocusLog),
      };
    }
  }
}
const rootSchemaContext = UISchemaContext.createRootContext(uiSchema, DataSchemaContext.createRootContext(dataSchema));

function buildInitialState(data: DataModel): AppState {
  const uiModel = buildUIModel(rootSchemaContext, data, emptyDataPath, undefined, undefined, undefined);
  return {data, uiModel};
}

export const RootView: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, buildInitialState(initialDataModel));
  const uiModel = buildUIModel(
    UISchemaContext.createRootContext(uiSchema, DataSchemaContext.createRootContext(dataSchema)),
    state.data,
    emptyDataPath,
    state.focus,
    state.dataFocusLog,
    state.schemaFocusLog,
  );

  return (
    <div>
      <UIView
        model={uiModel}
        onChangeData={(action) => dispatch({type: 'data', action})}
        onFocusByDataPath={(path) => dispatch({type: 'focus', path})}
      />
    </div>
  );
};
