import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import * as ReactDOM from 'react-dom';
import {RootView} from '@foxcel/ui-react';
import {Theme} from '@foxcel/ui-react/dist/types';
import {ThemeProvider} from 'styled-components';
import {BackToFrontMessage, FrontToBackMessage} from '@foxcel/core/dist/messages';
import {DataModel, unknownToDataModel} from '@foxcel/core';
import DataMapper, {FileDataMapNode} from '@foxcel/core/dist/Storage/DataMapper';
import {dataModelStorageDataTrait} from '@foxcel/core/dist/DataModel/DataModelStorageDataTrait';
import {DataSchemaExcludeRecursive} from '@foxcel/core/dist/DataModel/DataSchema';
import {UISchemaExcludeRecursive} from '@foxcel/core/dist/UIModel/UISchema';
import {WriteOnlyRemoteDataStorage} from '@foxcel/core/dist/Storage/WriteOnlyRemoteDataStorage';
import {JsonDataFormatter} from '@foxcel/core/dist/Storage/JsonDataFormatter';

const defaultTheme: Theme = {
  color: {
    bg: {
      normal: 'var(--vscode-editor-background)',
      active: 'var(--vscode-editor-selectionBackground)',
      label: 'var(--vscode-sideBar-background)',
      inactiveTab: 'var(--vscode-tab-inactiveBackground)',
      input: 'var(--vscode-input-background)',
      popup: 'var(--vscode-editorWidget-background)',
      itemHover: 'var(--vscode-list-hoverBackground)',
      itemSelection: 'var(--vscode-list-inactiveSelectionBackground)',
    },
    border: {
      inputFocus: 'var(--vscode-focusBorder)',
      input: 'var(--vscode-settings-textInputBorder)',
      popup: 'var(--vscode-editorWidget-border)',
      // 適切なスタイルが無いので、placeholderの色で代用
      tab: 'var(--vscode-input-placeholderForeground)',
      // 適切なスタイルが無いので、placeholderの色で代用
      table: 'var(--vscode-input-placeholderForeground)',
      list: 'var(--vscode-panel-border)',
    },
  },
  font: {
    size: {
      label: 'var(--vscode-font-size)',
      input: 'var(--vscode-editor-font-size)',
    },
    family: {
      label: 'var(--vscode-font-family)',
      input: 'var(--vscode-editor-font-family)',
    },
    color: {
      label: 'var(--vscode-foreground)',
      input: 'var(--vscode-input-foreground)',
      popup: 'var(--vscode-editorWidget-foreground)',
      placeholder: 'var(--vscode-input-placeholderForeground)',
    },
  },
};

interface InitialLoadItems {
  readonly data: DataModel;
  readonly dataMapper: DataMapper;
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly dataSchema: DataSchemaExcludeRecursive;
}

const vscode = acquireVsCodeApi();
function sendMessage(message: FrontToBackMessage): void {
  vscode.postMessage(message);
}

const App: React.FC = () => {
  const [loaded, setLoaded] = useState<InitialLoadItems>();
  const [lastFileMap, setLastFileMap] = useState<FileDataMapNode<DataModel>>();
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message: BackToFrontMessage = event.data;
      switch (message.type) {
        case 'initialLoad':
          const dataModel = unknownToDataModel(message.data);
          const dataMapper = DataMapper.build(message.dataMapperConfig);
          const fileDataMap = dataMapper.makeFileDataMap(dataModel, dataModelStorageDataTrait);
          setLoaded({data: dataModel, dataMapper, dataSchema: message.uiSchema.dataSchema, uiSchema: message.uiSchema});
          setLastFileMap(fileDataMap);
          break;
      }
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
    };
  });

  const save = useCallback(
    async (model: DataModel) => {
      if (!loaded || !lastFileMap) return;

      const storage = new WriteOnlyRemoteDataStorage();
      const nextFileMap = await loaded.dataMapper.saveAsync(
        lastFileMap,
        model,
        storage,
        dataModelStorageDataTrait,
        new JsonDataFormatter(),
      );
      sendMessage({
        type: 'saveFile',
        items: storage.items,
        deletePaths: storage.deletePaths,
      });
      setLastFileMap(nextFileMap);
    },
    [lastFileMap, loaded],
  );

  return <RootView loaded={loaded} saveFile={save} />;
};

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
