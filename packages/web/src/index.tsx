import React from 'react';
import ReactDOM from 'react-dom';
import * as serviceWorker from './serviceWorker';
import {RootView} from '@foxcel/ui-react';
import {NativeFileSystemDataStorage} from './Models/NativeFileSystemDataStorage';
import YamlDataFormatter from '@foxcel/core/dist/Storage/YamlDataFormatter';
import {loadFile} from '@foxcel/core/dist/FileLoader';
import {AppInitializeAction} from '@foxcel/core/dist/App/AppState';
import {ThemeProvider} from 'styled-components';
import {Theme} from '@foxcel/ui-react/dist/types';

async function loadFile_(): Promise<AppInitializeAction> {
  const storage = new NativeFileSystemDataStorage();
  await storage.init();
  const {uiSchema, dataSchema, data} = await loadFile(storage, [storage.rootSchemaFiles[0]], new YamlDataFormatter());
  return {type: 'init', uiSchema, dataSchema, data};
}

const defaultTheme: Theme = {
  color: {
    bg: {
      normal: 'white',
      active: 'lightblue',
      label: 'lightgray',
      disabled: 'lightgray',
      input: 'white',
    },
    border: {
      inputFocus: 'black',
      input: 'gray',
    },
  },
  font: {
    size: {
      label: '16px',
      input: '16px',
    },
    family: {
      label: 'Meiryo',
      input: 'Meiryo',
    },
    color: {
      label: 'black',
      input: 'black',
    },
  },
};

const vsCodeTheme: Theme = {
  color: {
    bg: {
      // --vscode-editor-background
      normal: '#1e1e1e',
      // --vscode-editor-selectionBackground
      active: '#264f78',
      // --vscode-sideBar-background
      label: '#252526',
      // --vscode-tab-inactiveBackground
      inactiveTab: '#2d2d2d',
      // --vscode-input-background
      input: '#3c3c3c',
      // --vscode-editorWidget-background
      popup: '#252526',
      // --vscode-list-hoverBackground
      itemHover: '#2a2d2e',
      // --vscode-list-inactiveSelectionBackground
      itemSelection: '#37373d',
    },
    border: {
      // --vscode-focusBorder
      inputFocus: '#007fd4',
      // --vscode-settings-textInputBorder
      input: 'transparent',
      // --vscode-editorWidget-border
      popup: '#454545',
      // 適切なスタイルが無いので、placeholderの色で代用
      // --vscode-input-placeholderForeground
      tab: '#a6a6a6',
      // --vscode-panel-border
      list: 'rgba(128, 128, 128, 0.35)',
      // 適切なスタイルが無いので、placeholderの色で代用
      // --vscode-input-placeholderForeground
      table: '#a6a6a6',
    },
  },
  font: {
    size: {
      // --vscode-font-size
      label: '13px',
      // --vscode-editor-font-size
      input: '14px',
    },
    family: {
      // --vscode-font-family
      label: '"Segoe WPC", "Segoe UI", sans-serif',
      // --vscode-editor-font-family
      input: 'Consolas, "Courier New", monospace',
    },
    color: {
      // --vscode-foreground
      label: '#cccccc',
      // --vscode-input-foreground
      input: '#cccccc',
      // --vscode-editorWidget-foreground
      popup: '#cccccc',
      // --vscode-input-placeholderForeground
      placeholder: '#a6a6a6',
    },
  },
};

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={vsCodeTheme}>
      <RootView loadFile={loadFile_} />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
