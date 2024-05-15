import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import * as ReactDOM from 'react-dom';
import {RootView} from '@foxcel/ui-react';
import {Theme} from '@foxcel/ui-react';
import {ThemeProvider} from 'styled-components';
import {
  AppAction,
  AppState,
  BackToFrontMessage,
  DataMapper,
  DataMapperConfig,
  DataModel,
  dataModelStorageDataTrait,
  DataSchemaExcludeRecursive,
  FileDataMapNode,
  FileDataStatusMapNode,
  FrontToBackMessage,
  JsonDataFormatter,
  UISchemaExcludeRecursive,
  unknownToDataModel,
  WriteOnlyRemoteDataStorage,
} from '@foxcel/core';

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
      itemSelection: 'var(--vscode-list-activeSelectionBackground)',
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
      itemSelection: 'var(--vscode-input-activeSelectionForeground)',
      error: 'var(--vscode-editorError-foreground)',
      warning: 'var(--vscode-editorWarning-foreground)',
    },
  },
};

interface InitialLoadItems {
  readonly data: DataModel;
  readonly rawData: unknown;
  readonly dataMapperConfig: DataMapperConfig | undefined;
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly dataSchema: DataSchemaExcludeRecursive;
  readonly restoredActions?: AppAction[];

  /**
   * Saved actions for redo
   */
  readonly restoredForwardActions?: AppAction[];
  readonly fileStatus?: FileDataStatusMapNode;
}

const vscode = acquireVsCodeApi();
function sendMessage(message: FrontToBackMessage): void {
  vscode.postMessage(message);
}

interface SavedState {
  readonly initial: {
    readonly rawData: unknown;
    readonly dataMapperConfig: DataMapperConfig | undefined;
    readonly uiSchema: UISchemaExcludeRecursive;
  };
  readonly actions: AppAction[];
  readonly forwardActions: AppAction[];
  readonly fileStatus: FileDataStatusMapNode;
}

function saveStateToVsCode(state: SavedState) {
  vscode.setState(state);
}

function loadStateFromVsCode(): SavedState | undefined {
  return vscode.getState() as SavedState | undefined;
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
          setLoaded({
            data: dataModel,
            rawData: message.data,
            dataMapperConfig: message.dataMapperConfig,
            dataSchema: message.uiSchema.dataSchema,
            uiSchema: message.uiSchema,
          });
          setLastFileMap(fileDataMap);
          break;
      }
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
    };
  }, []);

  useEffect(() => {
    const restoredState = loadStateFromVsCode();
    if (restoredState) {
      const dataModel = unknownToDataModel(restoredState.initial.rawData);
      setLoaded({
        data: dataModel,
        rawData: restoredState.initial.rawData,
        dataMapperConfig: restoredState.initial.dataMapperConfig,
        dataSchema: restoredState.initial.uiSchema.dataSchema,
        uiSchema: restoredState.initial.uiSchema,
        restoredActions: restoredState.actions,
        restoredForwardActions: restoredState.forwardActions,
        fileStatus: restoredState.fileStatus,
      });
    }
  }, []);

  const save = useCallback(
    async (model: DataModel) => {
      if (!loaded || !lastFileMap) return;

      const storage = new WriteOnlyRemoteDataStorage();
      const dataMapper = DataMapper.build(loaded.dataMapperConfig);
      const nextFileMap = await dataMapper.saveAsync(
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

  const saveState = useCallback(
    (state: AppState) => {
      if (loaded) {
        const dataMapper = DataMapper.build(loaded.dataMapperConfig);
        if (lastFileMap) {
          saveStateToVsCode({
            initial: {
              rawData: loaded.rawData,
              dataMapperConfig: loaded.dataMapperConfig,
              uiSchema: loaded.uiSchema,
            },
            fileStatus: dataMapper.makeFileDataStatusMapNode(lastFileMap, state.data, dataModelStorageDataTrait),
            actions: state.actionHistories.map((i) => i.action),
            forwardActions: state.forwardActions,
          });
        } else if (loaded.fileStatus && state.rootUISchemaContext) {
          // 本当はloadStateFromVsCodeした直後にこの処理をやりたいが、データモデルにアクションを適用するのはRootView内で行うので、
          // 初期化のアクション適用後にonChangeStateが呼ばれることを期待してここで行う
          // 良い作りではないので要修正 AppStateの管理をRootViewの外側で行う?
          const restoredFileMap = dataMapper.remakeFileDataMap(
            state.data,
            dataModelStorageDataTrait,
            loaded.fileStatus,
          );
          setLastFileMap(restoredFileMap);
        }
      }
    },
    [loaded, lastFileMap],
  );

  return React.createElement(RootView, {loaded, saveFile: save, onChangeState: saveState});
};

ReactDOM.render(
  React.createElement(
    React.StrictMode,
    {},
    React.createElement(ThemeProvider, {theme: defaultTheme}, React.createElement(App)),
  ),
  document.getElementById('root'),
);
