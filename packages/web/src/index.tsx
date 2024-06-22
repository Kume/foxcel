import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as serviceWorker from './serviceWorker';
import {guessPlatformByUserAgent, PlatformContext, PlatformContextProps, RootView} from '@foxcel/ui-react';
import {NativeFileSystemDataStorage} from './Models/NativeFileSystemDataStorage';
import {
  ObjectDataStorage,
  AppInitializeAction,
  buildDataSchema,
  buildUISchema,
  FullSpecSchemaSample,
  loadFile,
  unknownToDataModel,
  YamlDataFormatter,
  RecursiveSchemaSample,
  validateDataModel,
  DataModelContext,
  DataModelValidationErrors,
  AppState,
  DBSchemaSample,
} from '@foxcel/core';
import {ThemeProvider} from 'styled-components';
import {LoadedData, Theme} from '@foxcel/ui-react';
import {sampleConfig} from '@foxcel/ui-react';
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
        testA5_03: {testA5a: 'testA5a_03\nInvalid line break', testA5b: 'testA5b_03'},
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
      testA1: 'aaa2\nbbb',
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
      error: 'red',
      warning: 'yellow',
    },
  },
};

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
    config: RecursiveSchemaSample.rootSchema(),
    data: RecursiveSchemaSample.basicInitialData(),
  },
  {
    label: '全部入り',
    name: '3',
    config: FullSpecSchemaSample.rootSchema(),
    data: FullSpecSchemaSample.basicInitialData(),
  },
  {
    label: 'DB設計',
    name: '4',
    config: DBSchemaSample.rootSchema(),
    data: DBSchemaSample.basicInitialData(),
  },
] as const;

const sampleDataConfigKey = 'sampleDataConfig';

const App: React.FC = () => {
  const [loaded, setLoaded] = useState<LoadedData>();
  const [selectedSample, setSelectedSample] = useState<string>();
  const [lastLoaded, setLastLoaded] = useState<LoadedData>();
  const platformProps = useMemo<PlatformContextProps>(
    () => ({
      platform: guessPlatformByUserAgent(window.navigator.userAgent),
    }),
    [],
  );

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

  const validate = useCallback(async (state: AppState): Promise<DataModelValidationErrors> => {
    return validateDataModel(
      DataModelContext.createRoot({model: state.data, schema: state.rootUISchemaContext.rootSchema.dataSchema}),
    );
  }, []);

  return (
    <div style={{backgroundColor: defaultTheme.color.bg.normal, height: '100%'}}>
      <div style={{backgroundColor: defaultTheme.color.bg.label}}>
        <label style={{color: defaultTheme.font.color.label}}>
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
      <PlatformContext.Provider value={platformProps}>
        <RootView loadFile={loadFile_} loaded={loaded} validate={validate} />
      </PlatformContext.Provider>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
