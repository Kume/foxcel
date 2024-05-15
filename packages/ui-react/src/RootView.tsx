import React, {useCallback, useEffect, useReducer, useRef, useState} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {
  AppAction,
  AppInitializeAction,
  applyAppActionToState,
  AppState,
  DataModel,
  DataModelRoot,
  DataModelValidationErrors,
} from '@foxcel/core';
import styled from 'styled-components';
import {LoadedData} from './types';
import {labelTextStyle} from './common/components/commonStyles';
import {useFloating} from '@floating-ui/react';

import {ErrorDisplay} from './dataEditor/components/ErrorDisplay';
import {ErrorMenu} from './dataEditor/components/ErrorMenu';

const LayoutRoot = styled.div`
  --basic-font-size: 16px;
  --label-font-weight: 500;
  background-color: ${({theme}) => theme.color.bg.normal};
`;

const Menu = styled.div`
  ${({theme}) => labelTextStyle(theme)});
  display: flex;
  justify-content: space-between;
`;

const MenuLeft = styled.div``;

interface Props {
  loadFile?(): Promise<AppInitializeAction>;
  saveFile?(model: DataModel | undefined): void;
  onChangeState?(state: AppState): void;
  validate?(state: AppState): Promise<DataModelValidationErrors>;
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

export const RootView: React.FC<Props> = ({loadFile, saveFile, loaded, onChangeState, validate}) => {
  const [state, dispatch] = useReducer(applyAppActionToState, initialState);
  const [errors, setErrors] = useState<DataModelValidationErrors>();
  const [errorMenuIsOpen, setErrorMenuIsOpen] = useState<boolean>(false);
  const execAction = useCallback((action: AppAction | undefined) => {
    if (action) {
      dispatch(action);
    }
  }, []);
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
    void validate?.(state).then((errors) => {
      setErrors(errors);
    });
  }, [state.data]);

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

  const {refs: floatingRefs, floatingStyles} = useFloating({
    placement: 'bottom-end',
  });

  return (
    <LayoutRoot>
      <Menu>
        <MenuLeft>
          {loadFile && <button onClick={async () => dispatch(await loadFile())}>LOAD</button>}
          {saveFile && <button onClick={() => saveFile(state.data)}>SAVE</button>}
        </MenuLeft>
        {errors && (
          <ErrorDisplay errors={errors} onErrorOpen={() => setErrorMenuIsOpen(true)} ref={floatingRefs.setReference} />
        )}
      </Menu>
      <ErrorMenu
        ref={floatingRefs.setFloating}
        style={floatingStyles}
        isOpen={errorMenuIsOpen}
        onClose={() => setErrorMenuIsOpen(false)}
        errors={errors ?? [[], []]}
        onSelect={(error) => {
          setErrorMenuIsOpen(false);
          dispatch({type: 'focus', dataContext: error[1]});
        }}
      />
      {state.uiModel && <UIView model={state.uiModel} onAction={execAction} getRoot={getRoot} />}
    </LayoutRoot>
  );
};
