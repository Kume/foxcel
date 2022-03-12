import React, {useCallback, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {TableUIModel, TableUIModelRow, UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {getIdFromDataPointer} from 'co-doc-editor-core';
import styled from 'styled-components';
import {
  copyFromTableUIModel,
  cutFromTableUIModel,
  pasteForTableUIModel,
  selectingTableCellRange,
  TableCellPoint,
  TableCellRange,
  TableRange,
  tableRangeContains,
} from 'co-doc-editor-core/dist/UIModel/TableUIModel';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {parseTsv, stringifyTsv} from 'co-doc-editor-core/dist/common/tsv';
import {TableCellCallbacks} from './TableUIViewCell';
import {TextUIViewForTableCell} from './TextUIView';
import {SelectUIViewForTableCell} from './SelectUIView';

const Table = styled.table`
  background-color: gray;
`;

const HeaderCell = styled.th`
  font-weight: normal;
  background-color: lightgray;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid gray;
`;

interface Props extends UIViewProps {
  readonly model: TableUIModel;
}

interface Selection {
  readonly origin: TableCellPoint;
  readonly isMouseActive: boolean;
  readonly range: TableCellRange;
}

export const TableUIView = React.memo<Props>(({model, onAction, getRoot}) => {
  const [editing, setEditing] = useState<TableCellPoint>();
  const [selection, setSelection] = useState<Selection>();
  const rootRef = useRef<HTMLTableElement | null>(null);
  const endMouseMove = useCallback(() => setSelection((origin) => origin && {...origin, isMouseActive: false}), []);
  const startMouseUpTracking = useMouseUpTracking(endMouseMove);

  const callbacks = useMemo<TableCellCallbacks>(
    () => ({
      onAction,
      getRoot,
      onMouseDown(e, row, col) {
        const point = {row, col};
        if (e.shiftKey) {
          if (selection) {
            setSelection({...selection, range: selectingTableCellRange(selection.origin, point)});
          }
        } else {
          setSelection({origin: point, isMouseActive: true, range: selectingTableCellRange(point, point)});
          startMouseUpTracking();
          startFocus();
        }
      },
      onMouseOver(e, row, col) {
        if (selection?.isMouseActive) {
          setSelection({...selection, range: selectingTableCellRange(selection.origin, {row, col})});
        }
      },
      onDoubleClick(e, row, col) {
        setEditing({row, col});
      },
    }),
    [onAction, selection],
  );

  const editFocusCallbacks = useMemo<EditFocusCallbacks>(
    () => ({
      onLostFocus: () => {
        setSelection(undefined);
        setEditing(undefined);
      },
      onPaste(data) {
        if (selection) {
          const result = pasteForTableUIModel(model, selection.range, parseTsv(data));
          if (result) {
            onAction(result.action);
            if (result.changedSelection) {
              setSelection({...selection, range: result.changedSelection});
            }
          }
          return true;
        }
        return false;
      },
      onCopy() {
        if (selection) {
          const data = copyFromTableUIModel(model, selection.range);
          return stringifyTsv(data);
        } else {
          return undefined;
        }
      },
      onCut() {
        if (selection) {
          const {action, data} = cutFromTableUIModel(model, selection.range);
          onAction(action);
          return stringifyTsv(data);
        } else {
          return undefined;
        }
      },
    }),
    [model, selection, onAction],
  );

  const {startFocus} = useEditFocusControl(rootRef, editFocusCallbacks);

  return (
    <Table cellSpacing={1} ref={rootRef}>
      <thead>
        <TableRow>
          {model.columns.map((column, index) => (
            <HeaderCell key={index}>{column.label}</HeaderCell>
          ))}
        </TableRow>
      </thead>
      <tbody>
        {model.rows.map((row, index) => (
          <TableRowView
            key={getIdFromDataPointer(row.pointer)}
            row={row}
            rowNumber={index}
            mainSelectedColumn={selection?.origin.row === index ? selection?.origin.col : undefined}
            selectionRange={tableRangeContains(selection?.range.row, index) ? selection?.range.col : undefined}
            callbacks={callbacks}
            editingColumn={editing?.row === index ? editing?.col : undefined}
          />
        ))}
      </tbody>
    </Table>
  );
});

TableUIView.displayName = 'TableUIView';

const ReadonlyCell = styled.td<{readonly selected: boolean}>`
  padding: 0 0;
  background-color: ${({selected}) => (selected ? 'lightblue' : 'white')};
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
`;

interface TableRowViewProps {
  readonly row: TableUIModelRow;
  readonly rowNumber: number;
  readonly editingColumn: number | undefined;
  readonly selectionRange: TableRange | undefined;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const TableRowView = React.memo<TableRowViewProps>(
  ({row, rowNumber, editingColumn, selectionRange, mainSelectedColumn, callbacks}) => {
    return (
      <TableRow>
        {row.cells.map((cell, index) => {
          const isSelected = tableRangeContains(selectionRange, index);
          const isMainSelected = mainSelectedColumn === index;
          return (
            <ReadonlyCell
              key={index}
              selected={isSelected}
              onMouseDown={(e) => callbacks.onMouseDown(e, rowNumber, index)}
              onMouseOver={(e) => callbacks.onMouseOver(e, rowNumber, index)}
              onDoubleClick={(e) => callbacks.onDoubleClick(e, rowNumber, index)}
            >
              {renderCell(cell, isMainSelected, rowNumber, index, callbacks)}
            </ReadonlyCell>
          );
        })}
      </TableRow>
    );
  },
);

function renderCell(model: UIModel, isMainSelected: boolean, row: number, col: number, callbacks: TableCellCallbacks) {
  switch (model.type) {
    case 'text':
      return (
        <TextUIViewForTableCell
          model={model}
          isMainSelected={isMainSelected}
          row={row}
          col={col}
          callbacks={callbacks}
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
        />
      );
    default:
      return <div>Error</div>;
  }
}

TableRowView.displayName = 'TableRowView';
