import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {TableUIModel, TableUIModelRow} from '@foxcel/core/dist/UIModel/UIModelTypes';
import {getIdFromDataPointer} from '@foxcel/core';
import {
  selectingTableCellRange,
  TableCellRange,
  TableRange,
  tableRangeContains,
  tableUIModelCopy,
  tableUIModelCut,
  tableUIModelDelete,
  tableUIModelMoveSelection,
  tableUIModelPaste,
  TableUISelection,
} from '@foxcel/core/dist/UIModel/TableUIModel';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {parseTsv, stringifyTsv} from '@foxcel/core/dist/common/tsv';
import {TableCellCallbacks} from './TableUIViewCell';
import {
  handleTableUIViewKeyboardInput,
  renderTableUIViewCell,
  TableUIViewCellLayout,
  TableUIViewHeaderCell,
  TableUIViewLayoutRoot,
  TableUIViewRow,
  TableUIViewState,
  updateTableUIViewStateSelection,
} from './TablueUIViewCommon';

interface ActionRef {
  readonly selection: TableUISelection | undefined;
  readonly model: TableUIModel;
}

const updateSelection = updateTableUIViewStateSelection;
const makeUpdateRange = (range: TableCellRange) => (prev: TableUIViewState) =>
  updateSelection(prev, ({origin}) => ({origin, range}));
const makeUpdateRangeByCallback = (updateRange: (prevSelection: TableUISelection) => TableCellRange) => (
  prev: TableUIViewState,
) => updateSelection(prev, (prevSelection) => ({origin: prevSelection.origin, range: updateRange(prevSelection)}));

interface Props extends UIViewProps {
  readonly model: TableUIModel;
}

export const TableUIView = React.memo<Props>(({model, onAction, getRoot}) => {
  const [state, setState] = useState<TableUIViewState>({isMouseActive: false});
  const layoutRootRef = useRef<HTMLTableElement | null>(null);
  const endMouseMove = useCallback(() => setState((origin) => origin && {...origin, isMouseActive: false}), []);
  const startMouseUpTracking = useMouseUpTracking(endMouseMove);
  const actionRef_: ActionRef = {selection: state.selection, model};
  const actionRef = useRef(actionRef_);
  actionRef.current = actionRef_;

  const editFocusCallbacks = useMemo<EditFocusCallbacks>(
    () => ({
      onLostFocus: () => {
        setState({isMouseActive: false});
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
              setState(makeUpdateRange(result.changedSelection));
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
          setState(makeUpdateRangeByCallback((prev) => selectingTableCellRange(prev.origin, point)));
        } else {
          setState({isMouseActive: true, selection: {origin: point, range: selectingTableCellRange(point, point)}});
          startMouseUpTracking();
          startFocus();
        }
      },
      onMouseOver(e, row, col) {
        setState((prev) =>
          prev.isMouseActive
            ? makeUpdateRangeByCallback(({origin}) => selectingTableCellRange(origin, {row, col}))(prev)
            : prev,
        );
      },
      onKeyDown(e, isEditing) {
        return handleKey(e, isEditing);
      },
    }),
    // getRoot, onAction, startFocus, startMouseUpTracking は更新されることが無い仕様なので、deps指定は不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleKey = useCallback((e: KeyboardEvent | React.KeyboardEvent, isEditing: boolean): boolean => {
    if (!actionRef.current.selection) {
      return false;
    }
    const selection = actionRef.current.selection;
    const model = actionRef.current.model;
    const handled = handleTableUIViewKeyboardInput(
      e,
      isEditing,
      (direction) =>
        setState((prev) =>
          updateSelection(prev, (prevSelection) =>
            tableUIModelMoveSelection(prevSelection, direction, model.rows.length, model.columns.length),
          ),
        ),
      () => onAction(tableUIModelDelete(model, selection.range)),
    );
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
    return handled;
    // onAction は更新されることが無い仕様なので、deps指定は不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const keyDownEventHandler = (e: KeyboardEvent) => {
      if (!layoutRootRef.current?.contains(e.target as any)) {
        handleKey(e, false);
      }
    };
    document.addEventListener('keydown', keyDownEventHandler);
    return () => {
      document.removeEventListener('keydown', keyDownEventHandler);
    };
  });

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
            mainSelectedColumn={state.selection?.origin.row === index ? state.selection?.origin.col : undefined}
            selectionRange={
              tableRangeContains(state.selection?.range.row, index) ? state.selection?.range.col : undefined
            }
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
