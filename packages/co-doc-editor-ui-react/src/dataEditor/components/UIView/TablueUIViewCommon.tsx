import styled from 'styled-components';
import {TableCellCallbacks} from './TableUIViewCell';
import {TextUIViewForTableCell} from './TextUIView';
import {SelectUIViewForTableCell} from './SelectUIView';
import {CheckboxUIViewForTableCell} from './CheckboxUIView';
import {NumberUIViewForTableCell} from './NumberUIView';
import React from 'react';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {TableUIModelMoveDirection, TableUISelection} from 'co-doc-editor-core/dist/UIModel/TableUIModel';
import {DataModel, emptyMapModel, ForwardDataPath, setToMapDataModel} from 'co-doc-editor-core';
import {UISchemaExcludeRecursive} from 'co-doc-editor-core/dist/UIModel/UISchema';
import {DataModelContext} from 'co-doc-editor-core/dist/DataModel/DataModelContext';
import {
  KeyValue_ArrowDown,
  KeyValue_ArrowLeft,
  KeyValue_ArrowRight,
  KeyValue_ArrowUp,
  KeyValue_Backspace,
  KeyValue_Delete,
  KeyValue_Enter,
  KeyValue_Tab,
  withoutModifierKey,
  withShiftKey,
} from '../../../common/Keybord';

export const TableUIViewLayoutRoot = styled.table`
  background-color: gray;
`;

export const TableUIViewCellLayout = styled.td<{readonly selected: boolean}>`
  padding: 0 0;
  background-color: ${({selected}) => (selected ? 'lightblue' : 'white')};
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
`;

export const TableUIViewHeaderCell = styled.th`
  font-weight: normal;
  background-color: lightgray;
  overflow-wrap: break-word;
  word-break: keep-all;
  padding: 0 4px;
`;

export const TableUIViewIndexCell = styled.th`
  font-weight: normal;
  background-color: #ddd;
  text-align: left;
  overflow-wrap: break-word;
  word-break: keep-all;
  padding: 0 4px;
`;

export const TableUIViewRow = styled.tr`
  border-bottom: 1px solid gray;
`;

export function renderTableUIViewCell(
  model: UIModel,
  isMainSelected: boolean,
  row: number,
  col: number,
  callbacks: TableCellCallbacks,
  disabled?: boolean,
): React.ReactNode {
  switch (model.type) {
    case 'text':
      return (
        <TextUIViewForTableCell
          model={model}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
          disabled={disabled}
        />
      );
    case 'select':
      return (
        <SelectUIViewForTableCell
          model={model}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
          disabled={disabled}
        />
      );
    case 'checkbox':
      return (
        <CheckboxUIViewForTableCell
          model={model}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
          disabled={disabled}
        />
      );
    case 'number':
      return (
        <NumberUIViewForTableCell
          model={model}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
          disabled={disabled}
        />
      );
    default:
      return <div>Error</div>;
  }
}

export function renderTableUIViewCellWithSchema(
  dataPath: ForwardDataPath,
  rowKey: string | null | undefined,
  cellKey: string,
  schema: UISchemaExcludeRecursive,
  dataContext: DataModelContext,
  isMainSelected: boolean,
  row: number,
  col: number,
  callbacks: TableCellCallbacks,
): React.ReactNode {
  const onEdit = (model: DataModel) => {
    const newRow = setToMapDataModel(emptyMapModel, cellKey, model);
    callbacks.onAction({type: 'data', action: {type: 'push', data: newRow, path: dataPath, key: rowKey}});
  };
  switch (schema.type) {
    case 'text':
      return (
        <TextUIViewForTableCell
          schema={{schema, onEdit, dataContext}}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
        />
      );
    case 'number':
      return (
        <NumberUIViewForTableCell
          schema={{schema, onEdit, dataContext}}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
        />
      );
    case 'select':
      return (
        <SelectUIViewForTableCell
          schema={{schema, onEdit, dataContext}}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
        />
      );
    case 'checkbox':
      return (
        <CheckboxUIViewForTableCell
          schema={{schema, onEdit, dataContext}}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
        />
      );
    default:
      return <div>Error</div>;
  }
}

export interface TableUIViewState {
  readonly isMouseActive: boolean;
  readonly selection?: TableUISelection;
}

export function updateTableUIViewStateSelection(
  prev: TableUIViewState,
  updateSelection: (selection: TableUISelection) => TableUISelection,
): TableUIViewState {
  return prev.selection ? {...prev, selection: updateSelection(prev.selection)} : prev;
}

export function handleTableUIViewKeyboardInput(
  e: KeyboardEvent | React.KeyboardEvent,
  onMoveSelection: (direction: TableUIModelMoveDirection) => void,
  onDelete: () => void,
): boolean {
  switch (e.key) {
    case KeyValue_Tab:
      if (withoutModifierKey(e)) {
        onMoveSelection('right');
        return true;
      } else if (withShiftKey(e)) {
        onMoveSelection('left');
        return true;
      }
      break;
    case KeyValue_Enter:
      if (withoutModifierKey(e)) {
        onMoveSelection('down');
        return true;
      } else if (withShiftKey(e)) {
        onMoveSelection('up');
        return true;
      }
      break;
    case KeyValue_Delete:
    case KeyValue_Backspace:
      if (withoutModifierKey(e)) {
        onDelete();
        return true;
      }
      break;
    case KeyValue_ArrowUp:
      if (withoutModifierKey(e)) {
        onMoveSelection('up');
        return true;
      }
      break;
    case KeyValue_ArrowRight:
      if (withoutModifierKey(e)) {
        onMoveSelection('right');
        return true;
      }
      break;
    case KeyValue_ArrowLeft:
      if (withoutModifierKey(e)) {
        onMoveSelection('left');
        return true;
      }
      break;
    case KeyValue_ArrowDown:
      if (withoutModifierKey(e)) {
        onMoveSelection('down');
        return true;
      }
      break;
  }
  return false;
}
