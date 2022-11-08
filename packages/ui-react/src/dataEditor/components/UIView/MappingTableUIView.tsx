import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {
  MappingTableUIModel,
  MappingTableUIModelEmptyRow,
  MappingTableUIModelNotEmptyRow,
  TableUIModelRow,
} from '@foxcel/core/dist/UIModel/UIModelTypes';
import {
  handleTableUIViewKeyboardInput,
  renderTableUIViewCell,
  renderTableUIViewCellWithSchema,
  TableUIViewCellLayout,
  TableUIViewHeaderCell,
  TableUIViewIndexCell,
  TableUIViewLayoutRoot,
  TableUIViewRow,
  TableUIViewState,
  updateTableUIViewStateSelection,
} from './TablueUIViewCommon';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {
  mappingTableRowSize,
  mappingTableUIModelCopy,
  mappingTableUIModelCut,
  mappingTableUIModelDelete,
  mappingTableUIModelPaste,
} from '@foxcel/core/dist/UIModel/MappingTableUIModel';
import {parseTsv, stringifyTsv} from '@foxcel/core/dist/common/tsv';
import {TableCellCallbacks} from './TableUIViewCell';
import {
  isEndOfTableRange,
  isStartOfTableRange,
  selectingTableCellRange,
  TableCellRange,
  TableRange,
  tableRangeContains,
  tableUIModelMoveSelection,
  TableUISelection,
} from '@foxcel/core/dist/UIModel/TableUIModel';
import styled from 'styled-components';
import {ForwardDataPath} from '@foxcel/core';

interface ActionRef {
  readonly selection: TableUISelection | undefined;
  readonly model: MappingTableUIModel;
}

const updateSelection = updateTableUIViewStateSelection;
const makeUpdateRange = (range: TableCellRange) => (prev: TableUIViewState) =>
  updateSelection(prev, ({origin}) => ({origin, range}));
const makeUpdateRangeByCallback = (updateRange: (prevSelection: TableUISelection) => TableCellRange) => (
  prev: TableUIViewState,
) => updateSelection(prev, (prevSelection) => ({origin: prevSelection.origin, range: updateRange(prevSelection)}));

interface Props extends UIViewProps {
  readonly model: MappingTableUIModel;
}

export const MappingTableUIView: React.FC<Props> = ({model, onAction, getRoot}) => {
  const [state, setState] = useState<TableUIViewState>({isMouseActive: false});
  const layoutRootRef = useRef<HTMLTableElement | null>(null);
  const endMouseMove = useCallback(() => setState((origin) => origin && {...origin, isMouseActive: false}), []);
  const startMouseUpTracking = useMouseUpTracking(endMouseMove);
  const actionRef_: ActionRef = {selection: state?.selection, model};
  const actionRef = useRef(actionRef_);
  actionRef.current = actionRef_;

  const editFocusCallbacks = useMemo<EditFocusCallbacks>(
    () => ({
      onLostFocus: () => {
        setState({isMouseActive: false});
      },
      onPaste(data) {
        if (actionRef.current.selection) {
          const result = mappingTableUIModelPaste(
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
          const data = mappingTableUIModelCopy(actionRef.current.model, actionRef.current.selection.range);
          return stringifyTsv(data);
        } else {
          return undefined;
        }
      },
      onCut() {
        if (actionRef.current.selection) {
          const {action, data} = mappingTableUIModelCut(actionRef.current.model, actionRef.current.selection.range);
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
          setState({
            isMouseActive: true,
            selection: {origin: point, range: selectingTableCellRange(point, point)},
          });
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
            tableUIModelMoveSelection(prevSelection, direction, mappingTableRowSize(model), model.columns.length),
          ),
        ),
      () => onAction(mappingTableUIModelDelete(model, selection.range)),
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
  const selectionRange = state.selection?.range;

  return (
    <TableUIViewLayoutRoot cellSpacing={1} ref={layoutRootRef}>
      <thead>
        <TableUIViewRow>
          <TableUIViewIndexCell
            selected={selectionRange && selectionRange.row.size === undefined && selectionRange.col.size === undefined}
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
              {...headerCallbacks.columns[index]}
            >
              {column.label}
            </TableUIViewHeaderCell>
          ))}
        </TableUIViewRow>
      </thead>
      <tbody>
        {model.rows.map((row, index) => {
          const props = {
            key: row.key,
            rowNumber: index,
            mainSelectedColumn: state.selection?.origin.row === index ? state.selection.origin.col : undefined,
            selectionRange: tableRangeContains(state.selection?.range.row, index)
              ? state.selection?.range.col
              : undefined,
            isSelectionStart: isStartOfTableRange(selectionRange?.row, index),
            isSelectionEnd: isEndOfTableRange(selectionRange?.row, index, mappingTableRowSize(model)),
            callbacks,
          } as const;
          return row.isEmpty ? (
            <MappingTableEmptyRowView {...props} row={row} tableDataPath={model.dataPath} />
          ) : (
            <MappingTableRowView {...props} row={row} />
          );
        })}
        {model.danglingRows.map((row, index) => {
          const rowIndex = index + model.rows.length;
          return (
            <MappingTableDanglingRowView
              key={row.key}
              row={row}
              rowNumber={rowIndex}
              mainSelectedColumn={state.selection?.origin.row === rowIndex ? state.selection.origin.col : undefined}
              selectionRange={
                tableRangeContains(state.selection?.range.row, rowIndex) ? state.selection?.range.col : undefined
              }
              isSelectionStart={isStartOfTableRange(selectionRange?.row, rowIndex)}
              isSelectionEnd={isEndOfTableRange(selectionRange?.row, rowIndex, mappingTableRowSize(model))}
              callbacks={callbacks}
            />
          );
        })}
      </tbody>
    </TableUIViewLayoutRoot>
  );
};

MappingTableUIView.displayName = 'MappingTableUIView';

interface MappingTableRowViewProps {
  readonly row: MappingTableUIModelNotEmptyRow;
  readonly rowNumber: number;
  readonly selectionRange: TableRange | undefined;
  readonly isSelectionStart: boolean;
  readonly isSelectionEnd: boolean;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const MappingTableRowView = React.memo<MappingTableRowViewProps>(
  ({row, rowNumber, selectionRange, isSelectionStart, isSelectionEnd, mainSelectedColumn, callbacks}) => {
    const headerCallbacks = useMemo(
      () => ({
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, rowNumber, undefined),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, rowNumber, undefined),
      }),
      [callbacks, rowNumber],
    );
    return (
      <TableUIViewRow>
        <TableUIViewIndexCell {...headerCallbacks} selected={selectionRange && selectionRange.size === undefined}>
          {row.key}
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

MappingTableRowView.displayName = 'MappingTableRowView';

interface MappingTableEmptyRowViewProps {
  readonly row: MappingTableUIModelEmptyRow;
  readonly rowNumber: number;
  readonly tableDataPath: ForwardDataPath;
  readonly selectionRange: TableRange | undefined;
  readonly isSelectionStart: boolean;
  readonly isSelectionEnd: boolean;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const MappingTableEmptyRowView = React.memo<MappingTableEmptyRowViewProps>(
  ({
    tableDataPath,
    row,
    rowNumber,
    selectionRange,
    isSelectionStart,
    isSelectionEnd,
    mainSelectedColumn,
    callbacks,
  }) => {
    const headerCallbacks = useMemo(
      () => ({
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, rowNumber, undefined),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, rowNumber, undefined),
      }),
      [callbacks, rowNumber],
    );
    return (
      <TableUIViewRow>
        <TableUIViewIndexCell {...headerCallbacks} selected={selectionRange && selectionRange.size === undefined}>
          {row.key}
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
              {renderTableUIViewCellWithSchema(
                tableDataPath,
                row.key,
                cell.key,
                cell.schema,
                cell.dataContext,
                isMainSelected,
                rowNumber,
                index,
                callbacks,
              )}
            </TableUIViewCellLayout>
          );
        })}
      </TableUIViewRow>
    );
  },
);

MappingTableEmptyRowView.displayName = 'MappingTableEmptyRowView';

interface MappingTableDanglingRowViewProps {
  readonly row: TableUIModelRow;
  readonly rowNumber: number;
  readonly selectionRange: TableRange | undefined;
  readonly isSelectionStart: boolean;
  readonly isSelectionEnd: boolean;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const DanglingIndexCell = styled(TableUIViewIndexCell)`
  background-color: red;
  color: white;
`;

const MappingTableDanglingRowView = React.memo<MappingTableDanglingRowViewProps>(
  ({row, rowNumber, selectionRange, isSelectionStart, isSelectionEnd, mainSelectedColumn, callbacks}) => {
    const headerCallbacks = useMemo(
      () => ({
        onMouseDown: (e: React.MouseEvent) => callbacks.onMouseDown(e, rowNumber, undefined),
        onMouseOver: (e: React.MouseEvent) => callbacks.onMouseOver(e, rowNumber, undefined),
      }),
      [callbacks, rowNumber],
    );
    const removeRow = () => callbacks.onAction({type: 'data', action: {type: 'delete', path: row.dataPath}});
    return (
      <TableUIViewRow>
        <DanglingIndexCell>
          <button onClick={removeRow}>x</button>
          {row.key}
        </DanglingIndexCell>
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
              {renderTableUIViewCell(cell, isMainSelected, rowNumber, index, callbacks, true)}
            </TableUIViewCellLayout>
          );
        })}
      </TableUIViewRow>
    );
  },
);

MappingTableDanglingRowView.displayName = 'MappingTableDanglingRowView';
