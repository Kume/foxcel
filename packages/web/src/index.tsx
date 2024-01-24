import React, {useCallback, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import * as serviceWorker from './serviceWorker';
import {RootView} from '@foxcel/ui-react';
import {NativeFileSystemDataStorage} from './Models/NativeFileSystemDataStorage';
import {
  ObjectDataStorage,
  AppInitializeAction,
  buildDataSchema,
  buildUISchema,
  FullSpecSchemaSample,
  loadFile,
  simpleRecursiveSampleConfig,
  unknownToDataModel,
  YamlDataFormatter,
} from '@foxcel/core';
import {ThemeProvider} from 'styled-components';
import {LoadedData, Theme} from '@foxcel/ui-react/dist/types';
import {sampleConfig} from '@foxcel/ui-react/dist/sample';
import {createRoot} from 'react-dom/client';

const loadedItemKey = 'DEBUG_loadedItem';

async function loadFile_(): Promise<AppInitializeAction> {
  const storage = new NativeFileSystemDataStorage();
  await storage.init();
  const loaded = await loadFile(storage, [storage.rootSchemaFiles[0]], new YamlDataFormatter());
  window.localStorage.setItem(loadedItemKey, JSON.stringify(loaded));
  const {uiSchema, dataSchema, data} = loaded;
  return {type: 'init', uiSchema, dataSchema, data};
}

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
      testA8: {
        testA5_01: {testA8a: 'testA8a'},
        testA8_dangling: {testA8a: 'testA8_dang'},
      },
      testA9: ['testA9_one', 'testA5_01', 'invalid'],
      testA10: {
        testA10_1: {},
      },
      testA11: '改行ありの\nテキストです。',
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

const defaultTheme: Theme = {
  color: {
    bg: {
      normal: 'white',
      active: 'lightblue',
      label: 'lightgray',
      inactiveTab: 'lightgray',
      input: 'white',
      popup: 'white',
      itemHover: 'lightgray',
      itemSelection: 'lightblue',
    },
    border: {
      inputFocus: 'blue',
      input: 'gray',
      popup: 'lightgray',
      tab: 'lightgray',
      list: 'lightgray',
      table: 'lightgray',
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
      popup: 'black',
      placeholder: 'gray',
      itemSelection: 'lightblue',
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
      itemSelection: '#094771',
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
      // --vscode-input-activeSelectionForeground
      itemSelection: '#094771',
    },
  },
};

const currentTheme = vsCodeTheme;

const samples = [
  {
    label: '色々',
    name: '1',
    config: sampleConfig,
    data: initialDataModel,
  },
  {
    label: '再帰',
    name: '2',
    config: simpleRecursiveSampleConfig,
    data: unknownToDataModel({
      root: [
        {
          label: 'test1',
          children: [{label: 'test1-1', children: []}],
        },
        {
          label: 'test2',
          children: [],
        },
      ],
    }),
  },
  {
    label: '全部入り',
    name: '3',
    config: FullSpecSchemaSample.rootSchema(),
    data: FullSpecSchemaSample.basicInitialData(),
  },
] as const;

const sampleDataConfigKey = 'sampleDataConfig';

const App: React.FC = () => {
  const [loaded, setLoaded] = useState<LoadedData>();
  const [selectedSample, setSelectedSample] = useState<string>();
  const [lastLoaded, setLastLoaded] = useState<LoadedData>();

  const selectSample = useCallback((selected: string) => {
    setSelectedSample((prev) => {
      if (prev === selected) {
        return prev;
      }

      void (async () => {
        const sample = samples.find(({name}) => name === selected);
        if (!sample) {
          return;
        }

        const storage = new ObjectDataStorage();
        const dataSchema = await buildDataSchema(sample.config, storage, new YamlDataFormatter());
        const uiSchema = await buildUISchema(sample.config, dataSchema, storage, new YamlDataFormatter());
        setLoaded({uiSchema, dataSchema, data: sample.data});
        window.localStorage.setItem(sampleDataConfigKey, selected);
      })();
      return selected;
    });
  }, []);

  useEffect(() => {
    const currentData = window.localStorage.getItem(sampleDataConfigKey);
    selectSample(currentData ?? '');

    const lastLoaded = window.localStorage.getItem(loadedItemKey);
    if (lastLoaded) {
      setLastLoaded(JSON.parse(lastLoaded));
    }
  }, [selectSample]);

  return (
    <div style={{backgroundColor: currentTheme.color.bg.normal, height: '100%'}}>
      <div style={{backgroundColor: currentTheme.color.bg.label}}>
        <label style={{color: currentTheme.font.color.label}}>
          サンプルデータ
          <select value={selectedSample} onChange={(e) => selectSample(e.target.value)}>
            <option value="">未選択</option>
            {samples.map(({label, name}) => {
              return (
                <option key={name} value={name}>
                  {label}
                </option>
              );
            })}
          </select>
          {lastLoaded && <button onClick={() => setLoaded(lastLoaded)}>リロード</button>}
        </label>
      </div>
      <RootView loadFile={loadFile_} loaded={loaded} />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={currentTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
