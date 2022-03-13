import React, {useCallback, useReducer, useRef} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {DataModel, unknownToDataModel} from 'co-doc-editor-core';
import {buildSimpleUISchema} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {buildSimpleDataSchema} from 'co-doc-editor-core/dist/DataModel/DataSchema';
import {buildUIModel} from 'co-doc-editor-core/dist/UIModel/UIModel';
import {UISchemaContext} from 'co-doc-editor-core/dist/UIModel/UISchemaContext';
import {sampleConfig} from './sample';
import {applyAppActionToState, AppState, AppInitializeAction} from 'co-doc-editor-core/dist/App/AppState';
import styled from 'styled-components';
import {DataModelRoot, emptyDataModelContext} from 'co-doc-editor-core/dist/DataModel/DataModelContext';

const dataSchema = buildSimpleDataSchema(sampleConfig);
const uiSchema = buildSimpleUISchema(sampleConfig, dataSchema);
const initialDataModel = unknownToDataModel({
  testA: {
    testA_value1: {
      testA1: 'aaa',
      testA2: 'A2-2',
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
      testA5: {
        testA5_01: {testA5a: 'testA5a_01', testA5b: 'testA5b_01', testA5c: 'AAAA'},
        testA5_02: {testA5a: 'testA5a_02', testA5b: 'testA5b_02', testA5c: 'CCCC'},
        testA5_03: {testA5a: 'testA5a_03', testA5b: 'testA5b_03'},
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

const rootSchemaContext = UISchemaContext.createRootContext(uiSchema);

function buildInitialState(data: DataModel): AppState {
  const uiModel = buildUIModel(
    rootSchemaContext,
    data,
    undefined,
    undefined,
    emptyDataModelContext,
    {model: data, schema: dataSchema},
    undefined,
    undefined,
    undefined,
  );
  return {data, dataSchema, uiSchema, rootUISchemaContext: rootSchemaContext, uiModel};
}

const LayoutRoot = styled.div`
  --basic-font-size: 16px;
  --label-font-weight: 500;
`;

const initialState = buildInitialState(initialDataModel);

interface Props {
  loadFile?(): AppInitializeAction;
}

export const RootView: React.FC<Props> = ({loadFile}) => {
  const [state, dispatch] = useReducer(applyAppActionToState, initialState);
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const getRoot = useCallback(
    (): DataModelRoot => ({model: stateRef.current.data, schema: stateRef.current.dataSchema}),
    [],
  );

  const load = async () => {
    if (loadFile) {
      dispatch(await loadFile());
    }
  };

  console.log('root', state);

  return (
    <LayoutRoot>
      <div onClick={load}>LOAD</div>
      <UIView model={state.uiModel} onAction={dispatch} getRoot={getRoot} />
    </LayoutRoot>
  );
};
