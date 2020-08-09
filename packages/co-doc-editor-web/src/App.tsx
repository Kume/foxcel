import React from 'react';
import logo from './logo.svg';
import './App.css';
import {NativeFileSystemDataStorage} from './Models/NativeFileSystemDataStorage';
import {loadFile} from 'co-doc-editor-core/dist/FileLoader';
import YamlDataFormatter from 'co-doc-editor-core/dist/Storage/YamlDataFormatter';

async function testLoad() {
  const storage = new NativeFileSystemDataStorage();
  await storage.init();
  try {
    const uiSchema = await loadFile(storage, [storage.rootSchemaFiles[0]], new YamlDataFormatter());
    console.log(uiSchema);
    alert('読み込み完了');
  } catch (error) {
    alert('読み込み…失敗…')
    console.error(error);
  }
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          onClick={testLoad}
        >
          ロード
        </a>
      </header>
    </div>
  );
}

export default App;
