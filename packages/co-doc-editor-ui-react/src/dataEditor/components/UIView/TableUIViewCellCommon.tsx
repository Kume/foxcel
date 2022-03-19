import styled from 'styled-components';
import {useCallback, useEffect, useMemo, useReducer} from 'react';

export const TextareaForTableCell = styled.textarea<{readonly isVisible: boolean}>`
  left: 0;
  top: 0;
  width: calc(100% - 8px);
  height: 100%;
  padding: 0 4px;
  overflow: hidden;
  position: absolute;
  overflow-wrap: break-word;
  word-break: keep-all;
  opacity: ${({isVisible}) => (isVisible ? 1 : 0)};

  background-color: transparent;
  font-size: var(--basic-font-size);
  // TODO ちゃんとフォントをセットする
  font-family: meiryo;

  border: none;
  &:focus {
    outline: none;
  }
`;

interface TableCellEditState {
  readonly isEditing: boolean;
  readonly editingText: string;
}

type TableCellEditStateAction = ['resetText' | 'changeText', string] | ['endEdit' | 'startEdit'];

function tableCellEditStateReducer(state: TableCellEditState, action: TableCellEditStateAction): TableCellEditState {
  switch (action[0]) {
    case 'resetText':
      return {isEditing: true, editingText: action[1]};
    case 'changeText':
      return {isEditing: state.isEditing, editingText: action[1]};
    case 'startEdit':
      return {isEditing: true, editingText: state.editingText};
    case 'endEdit':
      return {isEditing: false, editingText: state.editingText};
  }
}

export interface UseTableCellEditStateReturn {
  readonly isEditing: boolean;
  readonly editingText: string;
  startEdit(): void;
  dispatch(action: TableCellEditStateAction): void;
}

export function makeUseTableCellEditState<Model>(modelToText: (model: Model) => string) {
  return (
    model: Model,
    isMainSelected: boolean,
    onChange: (model: Model, text: string) => void,
  ): UseTableCellEditStateReturn => {
    const modelText = useMemo(() => modelToText(model), [model]);
    const [state, dispatch] = useReducer(tableCellEditStateReducer, {isEditing: false, editingText: modelText});
    const startEdit = useCallback(() => dispatch(['startEdit']), []);

    // DataModelがこのコンポーネントでの編集以外の要因で変更されたら、そちらに合わせて編集用のテキストも更新する
    useEffect(() => {
      dispatch(['resetText', modelText]);
    }, [modelText]);

    useEffect(() => {
      if (!isMainSelected) {
        dispatch(['endEdit']);
        if (modelText !== state.editingText) {
          onChange(model, state.editingText);
        }
      }
      // isMainSelectedがtrueからfalseになった時だけ実行したい意図なので、他のdepsは不要
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMainSelected]);

    return {...state, startEdit, dispatch};
  };
}
