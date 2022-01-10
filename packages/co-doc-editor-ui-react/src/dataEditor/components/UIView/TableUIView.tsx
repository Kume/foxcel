import React, {useCallback, useMemo, useRef, useState} from 'react';
import {UIView, UIViewProps} from './UIView';
import {TableUIModel, TableUIModelRow} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {getIdFromDataPointer} from 'co-doc-editor-core';
import {AppAction} from 'co-doc-editor-core/dist/App/AppState';
import {ReadOnlyUIView} from './ReadOnlyUIView';
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

const ReadonlyCell = styled.td<{readonly selected: boolean}>`
  padding: 0 4px;
  background-color: ${({selected}) => (selected ? 'lightblue' : 'white')};
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
`;

const EditingCell = styled.td`
  padding: 0;
  background-color: white;
`;

interface Props extends UIViewProps {
  readonly model: TableUIModel;
}

interface Selection {
  readonly origin: TableCellPoint;
  readonly isMouseActive: boolean;
  readonly range: TableCellRange;
}

export const TableUIView = React.memo<Props>(({model, onAction}) => {
  const [editing, setEditing] = useState<TableCellPoint>();
  const [selection, setSelection] = useState<Selection>();
  const rootRef = useRef<HTMLTableElement | null>(null);
  const endMouseMove = useCallback(() => setSelection((origin) => origin && {...origin, isMouseActive: false}), []);
  const startMouseUpTracking = useMouseUpTracking(endMouseMove);

  const callbacks = useMemo<TableRowCallbacks>(
    () => ({
      onAction,
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

interface TableRowCallbacks {
  readonly onAction: (action: AppAction) => void;
  readonly onMouseDown: (e: React.MouseEvent, row: number, column: number) => void;
  readonly onMouseOver: (e: React.MouseEvent, row: number, column: number) => void;
  readonly onDoubleClick: (e: React.MouseEvent, row: number, column: number) => void;
}

interface TableRowViewProps {
  readonly row: TableUIModelRow;
  readonly rowNumber: number;
  readonly editingColumn: number | undefined;
  readonly selectionRange: TableRange | undefined;
  readonly callbacks: TableRowCallbacks;
}

const TableRowView = React.memo<TableRowViewProps>(({row, rowNumber, editingColumn, selectionRange, callbacks}) => {
  return (
    <TableRow>
      {row.cells.map((cell, index) => {
        return editingColumn === index ? (
          <EditingCell key={index}>
            <UIView model={cell} onAction={callbacks.onAction} />
          </EditingCell>
        ) : (
          <ReadonlyCell
            key={index}
            selected={tableRangeContains(selectionRange, index)}
            onMouseDown={(e) => callbacks.onMouseDown(e, rowNumber, index)}
            onMouseOver={(e) => callbacks.onMouseOver(e, rowNumber, index)}
            onDoubleClick={(e) => callbacks.onDoubleClick(e, rowNumber, index)}>
            <ReadOnlyUIView model={cell} />
          </ReadonlyCell>
        );
      })}
    </TableRow>
  );
});

TableRowView.displayName = 'TableRowView';
