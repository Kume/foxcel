import styled from 'styled-components';
import {TableCellCallbacks} from './TableUIViewCell';
import {TextUIViewForTableCell} from './TextUIView';
import {SelectUIViewForTableCell} from './SelectUIView';
import {CheckboxUIViewForTableCell} from './CheckboxUIView';
import {NumberUIViewForTableCell} from './NumberUIView';
import React from 'react';
import {TableUIModelMoveDirection, TableUISelection, UIModel} from '@foxcel/core';
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
import {breakableTextStyle, labelTextStyle} from '../../../common/components/commonStyles';

export const TableUIViewLayoutRoot = styled.table`
  background-color: ${({theme}) => theme.color.border.table};
`;

const disableUserSelectStyle = `
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
`;

export const TableUIViewCellLayoutElement = styled.td<{readonly selected: boolean}>`
  padding: 0 0;
  position: relative;
  // background-color: ${({selected, theme}) => (selected ? theme.color.bg.active : theme.color.bg.normal)};
  background-color: ${({theme}) => theme.color.bg.normal};
  ${disableUserSelectStyle}
`;

const CellSelectionBorderWidth = '2px';

const CellSelectionBorderTop = styled.div`
  position: absolute;
  top: -${CellSelectionBorderWidth};
  left: -${CellSelectionBorderWidth};
  height: ${CellSelectionBorderWidth};
  width: calc(100% + ${CellSelectionBorderWidth} + ${CellSelectionBorderWidth});
  background-color: ${({theme}) => theme.color.border.inputFocus};
`;

const CellSelectionBorderRight = styled.div`
  position: absolute;
  top: -${CellSelectionBorderWidth};
  right: -${CellSelectionBorderWidth};
  height: calc(100% + ${CellSelectionBorderWidth} + ${CellSelectionBorderWidth});
  width: ${CellSelectionBorderWidth};
  background-color: ${({theme}) => theme.color.border.inputFocus};
  z-index: 1;
`;

const CellSelectionBorderBottom = styled.div`
  position: absolute;
  bottom: -${CellSelectionBorderWidth};
  left: -${CellSelectionBorderWidth};
  height: ${CellSelectionBorderWidth};
  width: calc(100% + ${CellSelectionBorderWidth} + ${CellSelectionBorderWidth});
  background-color: ${({theme}) => theme.color.border.inputFocus};
  z-index: 1;
`;

const CellSelectionBorderLeft = styled.div`
  position: absolute;
  top: -${CellSelectionBorderWidth};
  left: -${CellSelectionBorderWidth};
  height: calc(100% + ${CellSelectionBorderWidth} + ${CellSelectionBorderWidth});
  width: ${CellSelectionBorderWidth};
  background-color: ${({theme}) => theme.color.border.inputFocus};
`;

type BorderVisibility = readonly [top?: boolean, right?: boolean, bottom?: boolean, left?: boolean];

interface TableUIViewCellLayoutProps extends React.PropsWithChildren {
  readonly selected: boolean;
  readonly border: BorderVisibility;
}

export const TableUIViewCellLayout: React.FC<TableUIViewCellLayoutProps> = ({selected, border, children}) => {
  return (
    <TableUIViewCellLayoutElement selected={selected}>
      {border[0] && <CellSelectionBorderTop />}
      {border[1] && <CellSelectionBorderRight />}
      {border[2] && <CellSelectionBorderBottom />}
      {border[3] && <CellSelectionBorderLeft />}
      {children}
    </TableUIViewCellLayoutElement>
  );
};

export const TableUIViewHeaderCell = styled.th<{readonly selected?: boolean}>`
  font-weight: normal;
  background-color: ${({theme, selected}) => (selected ? theme.color.bg.active : theme.color.bg.label)};
  ${({theme}) => labelTextStyle(theme)}
  ${breakableTextStyle}
  ${disableUserSelectStyle}
  padding: 0 4px;
`;

export const TableUIViewIndexCell = styled.th<{readonly selected?: boolean}>`
  font-weight: normal;
  background-color: ${({selected, theme}) => (selected ? theme.color.bg.active : theme.color.bg.label)};
  ${({theme}) => labelTextStyle(theme)}
  ${breakableTextStyle}
  ${disableUserSelectStyle}
  text-align: left;
  padding: 0 4px;
`;

export const TableUIViewRow = styled.tr`
  border-bottom: 1px solid ${({theme}) => theme.color.border.table};
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
  isEditing: boolean,
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
      if (!isEditing && withoutModifierKey(e)) {
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
