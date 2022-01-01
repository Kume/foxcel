import React, {useReducer} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {DataModel, emptyDataPath, unknownToDataModel} from 'co-doc-editor-core';
import {buildSimpleUISchema} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {buildSimpleDataSchema, DataSchemaContext} from 'co-doc-editor-core/dist/DataModel/DataSchema';
import {buildUIModel} from 'co-doc-editor-core/dist/UIModel/UIModel';
import {UISchemaContext} from 'co-doc-editor-core/dist/UIModel/UISchemaContext';
import {sampleConfig} from './sample';
import {applyAppActionToState, AppState} from 'co-doc-editor-core/dist/App/AppState';

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

const rootSchemaContext = UISchemaContext.createRootContext(uiSchema, DataSchemaContext.createRootContext(dataSchema));

function buildInitialState(data: DataModel): AppState {
  const uiModel = buildUIModel(rootSchemaContext, data, emptyDataPath, undefined, undefined, undefined);
  return {data, dataSchema, uiSchema, rootUISchemaContext: rootSchemaContext, uiModel};
}

const initialState = buildInitialState(initialDataModel);
export const RootView: React.FC = () => {
  const [state, dispatch] = useReducer(applyAppActionToState, initialState);

  console.log('root', state);

  return (
    <div>
      <UIView model={state.uiModel} onAction={dispatch} />
    </div>
  );
};
