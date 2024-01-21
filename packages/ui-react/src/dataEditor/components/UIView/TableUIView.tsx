import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {
  getIdFromDataPointer,
  isEndOfTableRange,
  isStartOfTableRange,
  parseTsv,
  selectingTableCellRange,
  stringifyTsv,
  TableCellRange,
  TableRange,
  tableRangeContains,
  TableUIModel,
  tableUIModelAddRows,
  tableUIModelContextMenus,
  tableUIModelCopy,
  tableUIModelCut,
  tableUIModelDelete,
  tableUIModelMoveSelection,
  tableUIModelPaste,
  TableUIModelRow,
  TableUISelection,
} from '@foxcel/core';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {TableCellCallbacks} from './TableUIViewCell';
import {
  handleTableUIViewKeyboardInput,
  renderTableUIViewCell,
  TableUIViewCellLayout,
  TableUIViewHeaderCell,
  TableUIViewIndexCell,
  TableUIViewLayoutRoot,
  TableUIViewRow,
  TableUIViewState,
  updateTableUIViewStateSelection,
} from './TablueUIViewCommon';
import {flip, shift, useFloating} from '@floating-ui/react-dom';
import {ContextMenu, ContextMenuProps, makeClickPointVirtualElement} from './ContextMenu';
import styled from 'styled-components';
import {inputTextStyle} from '../../../common/components/commonStyles';

interface ActionRef {
  readonly selection: TableUISelection | undefined;
  readonly model: TableUIModel;
}

const updateSelection = updateTableUIViewStateSelection;
const makeUpdateRange = (range: TableCellRange) => (prev: TableUIViewState) =>
  updateSelection(prev, ({origin}) => ({origin, range}));
const makeUpdateRangeByCallback =
  (updateRange: (prevSelection: TableUISelection) => TableCellRange) => (prev: TableUIViewState) =>
    updateSelection(prev, (prevSelection) => ({origin: prevSelection.origin, range: updateRange(prevSelection)}));

const AdditionalRow = styled.div`
  margin-top: 6px;
  display: flex;
  padding: 0 10px;
`;

const RowsInput = styled.input`
  background-color: ${({theme}) => theme.color.bg.input};
  border: solid 1px ${({theme}) => theme.color.border.input};
  ${({theme}) => inputTextStyle(theme)}
  width: 60px;
  &:focus {
    border-color: ${({theme}) => theme.color.border.inputFocus};
    outline: none;
  }
`;

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

  const [contextMenuProp, setContextMenuProp] = useState<Omit<ContextMenuProps, 'onClose'>>();
  const {x, y, reference, floating, strategy} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });
  const openContextMenu = useCallback(
    (rowNumber: number, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      setContextMenuProp({
        isOpen: true,
        items: tableUIModelContextMenus(actionRef.current.model, rowNumber, actionRef.current.selection).map(
          ({label, action}) => ({
            label,
            onClick: () => {
              onAction(action);
              setContextMenuProp(undefined);
            },
          }),
        ),
      });
      reference(makeClickPointVirtualElement(e));
    },
    [onAction, reference],
  );
  const closeContextMenu = useCallback(() => setContextMenuProp(undefined), []);

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
        switch (e.button) {
          case 0:
            if (e.shiftKey) {
              setState(makeUpdateRangeByCallback((prev) => selectingTableCellRange(prev.origin, point)));
            } else {
              setState({
                isMouseActive: true,
                selection: {origin: point, range: selectingTableCellRange(point, point)},
              });
              startMouseUpTracking();
              startFocus();
            }
            break;

          case 2:
            break;

          default:
            // ホイールボタンクリック等左右クリックでない場合は何もしない
            break;
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

  const headerCallbacks = useMemo(
    () => ({
      corner: {
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, undefined, undefined),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, undefined, undefined),
      },
      columns: model.columns.map((_, index) => ({
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, undefined, index),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, undefined, index),
      })),
    }),
    [callbacks, model.columns],
  );

  const [rowsText, setRowsText] = useState('');
  const addRows = useCallback(() => {
    const result = tableUIModelAddRows(model, rowsText);
    switch (result.t) {
      case 'action':
        onAction(result.action);
        break;
      case 'error':
        // TODO
        break;
    }
  }, [model, rowsText, onAction]);

  const selectionRange = state.selection?.range;

  return (
    <>
      <TableUIViewLayoutRoot cellSpacing={1} ref={layoutRootRef}>
        <thead>
          <TableUIViewRow>
            <TableUIViewHeaderCell
              selected={
                selectionRange && selectionRange.row.size === undefined && selectionRange.col.size === undefined
              }
              {...headerCallbacks.corner}
            />
            {model.columns.map((column, index) => (
              <TableUIViewHeaderCell
                key={index}
                selected={
                  tableRangeContains(selectionRange?.col, index) &&
                  selectionRange &&
                  selectionRange.row.size === undefined
                }
                {...headerCallbacks.columns[index]}>
                {column.label}
              </TableUIViewHeaderCell>
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
              selectionRange={tableRangeContains(selectionRange?.row, index) ? selectionRange?.col : undefined}
              isSelectionStart={isStartOfTableRange(selectionRange?.row, index)}
              isSelectionEnd={isEndOfTableRange(selectionRange?.row, index, model.rows.length)}
              callbacks={callbacks}
              onContextMenu={openContextMenu}
            />
          ))}
        </tbody>
      </TableUIViewLayoutRoot>
      <AdditionalRow>
        <RowsInput
          value={rowsText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRowsText(e.target.value)}
        />
        行<button onClick={addRows}>追加</button>
      </AdditionalRow>
      <ContextMenu
        ref={floating}
        style={{position: strategy, left: x ?? 0, top: y ?? 0}}
        {...contextMenuProp}
        onClose={closeContextMenu}
      />
    </>
  );
});

TableUIView.displayName = 'TableUIView';

interface TableRowViewProps {
  readonly row: TableUIModelRow;
  readonly rowNumber: number;
  readonly selectionRange: TableRange | undefined;
  readonly isSelectionStart: boolean;
  readonly isSelectionEnd: boolean;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
  readonly onContextMenu: (rowNumber: number, event: React.MouseEvent<HTMLElement>) => void;
}

const TableRowView = React.memo<TableRowViewProps>(
  ({
    row,
    rowNumber,
    selectionRange,
    isSelectionStart,
    isSelectionEnd,
    mainSelectedColumn,
    callbacks,
    onContextMenu,
  }) => {
    const openContextMenu = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        onContextMenu(rowNumber, event);
      },
      [onContextMenu, rowNumber],
    );
    const headerCallbacks = useMemo(
      () => ({
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, rowNumber, undefined),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, rowNumber, undefined),
      }),
      [callbacks, rowNumber],
    );
    return (
      <TableUIViewRow onContextMenu={openContextMenu}>
        <TableUIViewIndexCell {...headerCallbacks} selected={selectionRange && selectionRange.size === undefined}>
          {rowNumber + 1}
        </TableUIViewIndexCell>
        {row.cells.map((cell, index) => {
          const isSelected = tableRangeContains(selectionRange, index);
          const border = [
            isSelected && isSelectionStart,
            isEndOfTableRange(selectionRange, index, row.cells.length),
            isSelected && isSelectionEnd,
            isStartOfTableRange(selectionRange, index),
          ] as const;
          const isMainSelected = mainSelectedColumn === index;
          return (
            <TableUIViewCellLayout key={index} selected={isSelected} border={border}>
              {renderTableUIViewCell(cell, isMainSelected, rowNumber, index, callbacks)}
            </TableUIViewCellLayout>
          );
        })}
      </TableUIViewRow>
    );
  },
);

TableRowView.displayName = 'TableRowView';
