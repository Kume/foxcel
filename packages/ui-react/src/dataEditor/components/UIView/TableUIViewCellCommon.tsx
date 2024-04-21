import {useCallback, useEffect, useMemo, useReducer} from 'react';

interface TableCellEditState {
  readonly isEditing: boolean;
  readonly editingText: string;
}

type TableCellEditStateAction = ['resetText' | 'changeText', string] | ['endEdit' | 'startEdit'];

function tableCellEditStateReducer(state: TableCellEditState, action: TableCellEditStateAction): TableCellEditState {
  switch (action[0]) {
    case 'changeText':
      return {isEditing: true, editingText: action[1]};
    case 'resetText':
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
    const modelText = useMemo(() => (model ? modelToText(model) : ''), [model]);
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
