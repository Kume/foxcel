import React from 'react';
import ReactDOM from 'react-dom';
import * as serviceWorker from './serviceWorker';
import {RootView} from 'co-doc-editor-ui-react';
import {NativeFileSystemDataStorage} from './Models/NativeFileSystemDataStorage';
import YamlDataFormatter from 'co-doc-editor-core/dist/Storage/YamlDataFormatter';
import {loadFile} from 'co-doc-editor-core/dist/FileLoader';
import {AppInitializeAction} from 'co-doc-editor-core/dist/App/AppState';

async function loadFile_(): Promise<AppInitializeAction> {
  const storage = new NativeFileSystemDataStorage();
  await storage.init();
  const {uiSchema, dataSchema, data} = await loadFile(storage, [storage.rootSchemaFiles[0]], new YamlDataFormatter());
  return {type: 'init', uiSchema, dataSchema, data};
}

ReactDOM.render(
  <React.StrictMode>
    <RootView loadFile={loadFile_} />
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
