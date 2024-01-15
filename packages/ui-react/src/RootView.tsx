import React, {useCallback, useEffect, useReducer, useRef} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {applyAppActionToState, AppState, AppInitializeAction} from '@foxcel/core/dist/App/AppState';
import styled from 'styled-components';
import {DataModelRoot} from '@foxcel/core/dist/DataModel/DataModelContext';
import {LoadedData} from './types';
import {DataModel} from '@foxcel/core';

const LayoutRoot = styled.div`
  --basic-font-size: 16px;
  --label-font-weight: 500;
  background-color: ${({theme}) => theme.color.bg.normal};
`;

interface Props {
  loadFile?(): Promise<AppInitializeAction>;
  saveFile?(model: DataModel | undefined): void;
  onChangeState?(state: AppState): void;
  readonly loaded?: LoadedData;
}

const initialState: AppState = {
  data: undefined,
  uiModel: undefined,
  uiSchema: undefined,
  dataSchema: undefined,
  // @ts-expect-error undefined許容にするとかなりの量のエラーが出る。本来はundefined許容であるべきな気がする => そもそもclassをstateに入れてるのが間違いっぽい
  rootUISchemaContext: undefined,
  actions: [],
};

export const RootView: React.FC<Props> = ({loadFile, saveFile, loaded, onChangeState}) => {
  const [state, dispatch] = useReducer(applyAppActionToState, initialState);
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const getRoot = useCallback((): DataModelRoot => {
    const state = stateRef.current;
    if (state.data && state.dataSchema) {
      return {model: state.data, schema: state.dataSchema};
    } else {
      // eslint-disable-next-line no-console
      console.error('unexpected function call.');
      throw new Error('unexpected function call.');
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      dispatch({type: 'init', ...loaded});
    }
  }, [loaded]);
  useEffect(() => {
    onChangeState?.(state);
  }, [onChangeState, state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // TODO 次回はselectでundoが効かない (フォーカスがselect内のtextareaに当たったまま) 問題を修正
      console.log(e.target, e.key);
      switch (e.key) {
        case 'z':
          if (e.target === document.body && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
              dispatch({type: 'redo'});
            } else {
              dispatch({type: 'undo'});
            }
          }
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <LayoutRoot>
      {loadFile && <button onClick={async () => dispatch(await loadFile())}>LOAD</button>}
      {saveFile && <button onClick={() => saveFile(state.data)}>SAVE</button>}
      {state.uiModel && <UIView model={state.uiModel} onAction={dispatch} getRoot={getRoot} />}
    </LayoutRoot>
  );
};
