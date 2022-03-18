import styled from 'styled-components';

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
  readonly editingText: string | null;
}

type TableCellEditStateAction = ['changeText', string] | ['endEdit'];

function tableCellEditStateReducer(state: TableCellEditState, action: TableCellEditStateAction): TableCellEditState {
  switch (action[0]) {
    case 'changeText':
      return {isEditing: true, editingText: action[1]};
    case 'endEdit':
      return {isEditing: false, editingText: state.editingText};
  }
}

export interface UseTableCellEditStateReturn {
  readonly isEditing: boolean;
  readonly editingText: string | null;
}

export function useTableCellEditState(): UseTableCellEditStateReturn {}
