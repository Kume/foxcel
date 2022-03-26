import React, {useCallback, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {
  MappingTableUIModel,
  MappingTableUIModelEmptyRow,
  MappingTableUIModelNotEmptyRow,
  TableUIModelRow,
} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {
  renderTableUIViewCell,
  renderTableUIViewCellWithSchema,
  TableUIViewCellLayout,
  TableUIViewHeaderCell,
  TableUIViewIndexCell,
  TableUIViewLayoutRoot,
  TableUIViewRow,
  TableUIViewSelection,
} from './TablueUIViewCommon';
import {useMouseUpTracking} from '../../../common/useMouseUpTracking';
import {EditFocusCallbacks, useEditFocusControl} from '../../../common/useEditFocusControl';
import {
  mappingTableUIModelCopy,
  mappingTableUIModelCut,
  mappingTableUIModelPaste,
} from 'co-doc-editor-core/dist/UIModel/MappingTableUIModel';
import {parseTsv, stringifyTsv} from 'co-doc-editor-core/dist/common/tsv';
import {TableCellCallbacks} from './TableUIViewCell';
import {selectingTableCellRange, TableRange, tableRangeContains} from 'co-doc-editor-core/dist/UIModel/TableUIModel';
import styled from 'styled-components';
import {ForwardDataPath} from 'co-doc-editor-core';

interface ActionRef {
  readonly selection: TableUIViewSelection | undefined;
  readonly model: MappingTableUIModel;
}

interface Props extends UIViewProps {
  readonly model: MappingTableUIModel;
}

export const MappingTableUIView: React.FC<Props> = ({model, onAction, getRoot}) => {
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
          const result = mappingTableUIModelPaste(
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
          <TableUIViewIndexCell />
          {model.columns.map((column, index) => (
            <TableUIViewHeaderCell key={index}>{column.label}</TableUIViewHeaderCell>
          ))}
        </TableUIViewRow>
      </thead>
      <tbody>
        {model.rows.map((row, index) =>
          row.isEmpty ? (
            <MappingTableEmptyRowView
              key={row.key}
              tableDataPath={model.dataPath}
              row={row}
              rowNumber={index}
              mainSelectedColumn={selection?.origin.row === index ? selection?.origin.col : undefined}
              selectionRange={tableRangeContains(selection?.range.row, index) ? selection?.range.col : undefined}
              callbacks={callbacks}
            />
          ) : (
            <MappingTableRowView
              key={row.key}
              row={row}
              rowNumber={index}
              mainSelectedColumn={selection?.origin.row === index ? selection?.origin.col : undefined}
              selectionRange={tableRangeContains(selection?.range.row, index) ? selection?.range.col : undefined}
              callbacks={callbacks}
            />
          ),
        )}
        {model.danglingRows.map((row, index) => (
          <MappingTableDanglingRowView
            key={row.key}
            row={row}
            rowNumber={index + model.rows.length}
            selectionRange={
              tableRangeContains(selection?.range.row, index + model.rows.length) ? selection?.range.col : undefined
            }
            callbacks={callbacks}
          />
        ))}
      </tbody>
    </TableUIViewLayoutRoot>
  );
};

MappingTableUIView.displayName = 'MappingTableUIView';

interface MappingTableRowViewProps {
  readonly row: MappingTableUIModelNotEmptyRow;
  readonly rowNumber: number;
  readonly selectionRange: TableRange | undefined;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const MappingTableRowView = React.memo<MappingTableRowViewProps>(
  ({row, rowNumber, selectionRange, mainSelectedColumn, callbacks}) => {
    return (
      <TableUIViewRow>
        <TableUIViewIndexCell>{row.key}</TableUIViewIndexCell>
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

MappingTableRowView.displayName = 'MappingTableRowView';

interface MappingTableEmptyRowViewProps {
  readonly row: MappingTableUIModelEmptyRow;
  readonly rowNumber: number;
  readonly tableDataPath: ForwardDataPath;
  readonly selectionRange: TableRange | undefined;
  readonly mainSelectedColumn: number | undefined;
  readonly callbacks: TableCellCallbacks;
}

const MappingTableEmptyRowView = React.memo<MappingTableEmptyRowViewProps>(
  ({tableDataPath, row, rowNumber, selectionRange, mainSelectedColumn, callbacks}) => {
    return (
      <TableUIViewRow>
        <TableUIViewIndexCell>{row.key}</TableUIViewIndexCell>
        {row.cells.map((cell, index) => {
          const isSelected = tableRangeContains(selectionRange, index);
          const isMainSelected = mainSelectedColumn === index;
          return (
            <TableUIViewCellLayout key={index} selected={isSelected}>
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
  readonly callbacks: TableCellCallbacks;
}

const DanglingIndexCell = styled(TableUIViewIndexCell)`
  background-color: red;
  color: white;
`;

const MappingTableDanglingRowView = React.memo<MappingTableDanglingRowViewProps>(
  ({row, rowNumber, selectionRange, callbacks}) => {
    const removeRow = () => callbacks.onAction({type: 'data', action: {type: 'delete', path: row.dataPath}});
    return (
      <TableUIViewRow>
        <DanglingIndexCell>
          <button onClick={removeRow}>x</button>
          {row.key}
        </DanglingIndexCell>
        {row.cells.map((cell, index) => {
          const isSelected = tableRangeContains(selectionRange, index);
          return (
            <TableUIViewCellLayout key={index} selected={isSelected}>
              {renderTableUIViewCell(cell, false, rowNumber, index, callbacks)}
            </TableUIViewCellLayout>
          );
        })}
      </TableUIViewRow>
    );
  },
);

MappingTableDanglingRowView.displayName = 'MappingTableDanglingRowView';
