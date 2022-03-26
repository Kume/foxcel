import React, {useCallback, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {TableUIModel, TableUIModelRow} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {getIdFromDataPointer} from 'co-doc-editor-core';
import {
  selectingTableCellRange,
  TableRange,
  tableRangeContains,
  tableUIModelCopy,
  tableUIModelCut,
  tableUIModelPaste,
} from 'co-doc-editor-core/dist/UIModel/TableUIModel';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {parseTsv, stringifyTsv} from 'co-doc-editor-core/dist/common/tsv';
import {TableCellCallbacks} from './TableUIViewCell';
import {
  renderTableUIViewCell,
  TableUIViewCellLayout,
  TableUIViewHeaderCell,
  TableUIViewLayoutRoot,
  TableUIViewRow,
  TableUIViewSelection,
} from './TablueUIViewCommon';

interface Props extends UIViewProps {
  readonly model: TableUIModel;
}

interface ActionRef {
  readonly selection: TableUIViewSelection | undefined;
  readonly model: TableUIModel;
}

export const TableUIView = React.memo<Props>(({model, onAction, getRoot}) => {
  const [selection, setSelection] = useState<TableUIViewSelection>();
  const layoutRootRef = useRef<HTMLTableElement | null>(null);
  const endMouseMove = useCallback(() => setSelection((origin) => origin && {...origin, isMouseActive: false}), []);
  const startMouseUpTracking = useMouseUpTracking(endMouseMove);
  const actionRef_: ActionRef = {selection, model};
  const actionRef = useRef(actionRef_);
  actionRef.current = actionRef_;

  const editFocusCallbacks = useMemo<EditFocusCallbacks>(
    () => ({
      onLostFocus: () => {
        setSelection(undefined);
      },
      onPaste(data) {
        if (actionRef.current.selection) {
          const result = tableUIModelPaste(
            actionRef.current.model,
            actionRef.current.selection.range,
            parseTsv(data),
            getRoot(),
          );
          if (result) {
            onAction(result.action);
            if (result.changedSelection) {
              setSelection({...actionRef.current.selection, range: result.changedSelection});
            }
          }
          return true;
        }
        return false;
      },
      onCopy() {
        if (actionRef.current.selection) {
          const data = tableUIModelCopy(actionRef.current.model, actionRef.current.selection.range);
          return stringifyTsv(data);
        } else {
          return undefined;
        }
      },
      onCut() {
        if (actionRef.current.selection) {
          const {action, data} = tableUIModelCut(actionRef.current.model, actionRef.current.selection.range);
          onAction(action);
          return stringifyTsv(data);
        } else {
          return undefined;
        }
      },
    }),
    // onAction は更新されることが無い仕様なので、deps指定は不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const {startFocus} = useEditFocusControl(layoutRootRef, editFocusCallbacks);

  const callbacks = useMemo<TableCellCallbacks>(
    () => ({
      onAction,
      getRoot,
      onMouseDown(e, row, col) {
        const point = {row, col};
        if (e.shiftKey) {
          setSelection((prev) => (prev ? {...prev, range: selectingTableCellRange(prev.origin, point)} : undefined));
        } else {
          setSelection({origin: point, isMouseActive: true, range: selectingTableCellRange(point, point)});
          startMouseUpTracking();
          startFocus();
        }
      },
      onMouseOver(e, row, col) {
        setSelection((prev) =>
          prev?.isMouseActive ? {...prev, range: selectingTableCellRange(prev.origin, {row, col})} : prev,
        );
      },
    }),
    // getRoot, onAction, startFocus, startMouseUpTracking は更新されることが無い仕様なので、deps指定は不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <TableUIViewLayoutRoot cellSpacing={1} ref={layoutRootRef}>
      <thead>
        <TableUIViewRow>
          {model.columns.map((column, index) => (
            <TableUIViewHeaderCell key={index}>{column.label}</TableUIViewHeaderCell>
          ))}
        </TableUIViewRow>
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
          />
        ))}
      </tbody>
    </TableUIViewLayoutRoot>
  );
});

TableUIView.displayName = 'TableUIView';

interface TableRowViewProps {
  readonly row: TableUIModelRow;
  readonly rowNumber: number;
  readonly selectionRange: TableRange | undefined;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const TableRowView = React.memo<TableRowViewProps>(
  ({row, rowNumber, selectionRange, mainSelectedColumn, callbacks}) => {
    return (
      <TableUIViewRow>
        {row.cells.map((cell, index) => {
          const isSelected = tableRangeContains(selectionRange, index);
          const isMainSelected = mainSelectedColumn === index;
          return (
            <TableUIViewCellLayout key={index} selected={isSelected}>
              {renderTableUIViewCell(cell, isMainSelected, rowNumber, index, callbacks)}
            </TableUIViewCellLayout>
          );
        })}
      </TableUIViewRow>
    );
  },
);

TableRowView.displayName = 'TableRowView';
