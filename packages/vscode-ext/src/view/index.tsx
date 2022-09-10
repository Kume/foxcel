import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {RootView} from '@foxcel/ui-react';
import {Theme} from '@foxcel/ui-react/dist/types';
import {ThemeProvider} from 'styled-components';
import {useEffect, useState} from 'react';

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

const App: React.FC = () => {
  const [loaded, setLoaded] = useState();
  useEffect(() => {
    const listener = (event) => {
      setLoaded(event.data.result);
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
    };
  });

  return <RootView loaded={loaded} />;
};

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
