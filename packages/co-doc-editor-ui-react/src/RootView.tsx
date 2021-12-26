import React, {useState} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {
  DataModel,
  DataSchemaConfig,
  emptyDataPath,
  ForwardDataPath,
  RootSchemaConfig,
  unknownToDataModel,
} from 'co-doc-editor-core';
import {buildSimpleUISchema, parseUISchemaConfig} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {buildDataSchema, buildSimpleDataSchema, DataSchemaContext} from 'co-doc-editor-core/dist/DataModel/DataSchema';
import {NamedItemNode} from 'co-doc-editor-core/dist/common/commonTypes';
import {buildUIModel} from 'co-doc-editor-core/dist/UIModel/UIModel';
import {UISchemaContext} from 'co-doc-editor-core/dist/UIModel/UISchemaContext';
import {DataModelAction, execDataModelAction} from 'co-doc-editor-core/dist/DataModel/DataModelAction';

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
                  testA3a1: {type: 'string', label: 'testA3a1'},
                  testA3a2: {type: 'string', label: 'testA3a2'},
                },
              },
              testA3b: {
                type: 'fixed_map',
                label: 'テストA3b',
                items: {
                  testA3b1: {type: 'string', label: 'testA3b1'},
                  testA3b2: {type: 'string', label: 'testA3b2'},
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

export const RootView: React.FC = () => {
  const [dataModel, setDataModel] = useState<DataModel | undefined>(initialDataModel);
  const [focus, setFocus] = useState<ForwardDataPath | undefined>();
  const uiModel = buildUIModel(
    UISchemaContext.createRootContext(uiSchema, DataSchemaContext.createRootContext(dataSchema)),
    dataModel,
    emptyDataPath,
    focus,
    undefined,
    undefined,
  );
  console.log('xxxx RootView', {dataModel, focus, uiModel, uiSchema});
  const onChangeData = (action: DataModelAction) => {
    console.log('action', action);
    setDataModel(execDataModelAction(dataModel, dataSchema, action));
  };
  return (
    <div>
      <UIView model={uiModel} onChangeData={onChangeData} onFocusByDataPath={setFocus} />
    </div>
  );
};
