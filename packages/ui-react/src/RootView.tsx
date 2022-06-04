import React, {useCallback, useEffect, useReducer, useRef} from 'react';
import {UIView} from './dataEditor/components/UIView/UIView';
import {DataModel} from '@foxcel/core';
import {UISchemaExcludeRecursive} from '@foxcel/core/dist/UIModel/UISchema';
import {DataSchemaExcludeRecursive} from '@foxcel/core/dist/DataModel/DataSchema';
import {applyAppActionToState, AppState, AppInitializeAction} from '@foxcel/core/dist/App/AppState';
import styled from 'styled-components';
import {DataModelRoot} from '@foxcel/core/dist/DataModel/DataModelContext';

const LayoutRoot = styled.div`
  --basic-font-size: 16px;
  --label-font-weight: 500;
  background-color: ${({theme}) => theme.color.bg.normal};
`;

interface Props {
  loadFile?(): Promise<AppInitializeAction>;
  readonly loaded?: {
    readonly uiSchema: UISchemaExcludeRecursive;
    readonly dataSchema: DataSchemaExcludeRecursive;
    readonly data: DataModel;
  };
}

const initialState: AppState = {
  data: undefined,
  uiModel: undefined,
  uiSchema: undefined,
  dataSchema: undefined,
  rootUISchemaContext: undefined,
};

export const RootView: React.FC<Props> = ({loadFile, loaded}) => {
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

  console.log('root', state);

  return (
    <LayoutRoot>
      {loadFile && <div onClick={async () => dispatch(await loadFile())}>LOAD</div>}
      {state.uiModel && <UIView model={state.uiModel} onAction={dispatch} getRoot={getRoot} />}
    </LayoutRoot>
  );
};
