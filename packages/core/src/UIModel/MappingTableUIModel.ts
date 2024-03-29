import {MappingTableUIModel} from './UIModelTypes';
import {
  TableCellRange,
  tableUIModelMakeNewRow,
  tableUIModelPasteCellAction,
  tableUIModelPasteRange,
  TableUIModelPasteResult,
  tableUIModelStringToDataModelWithSchema,
} from './TableUIModel';
import {AppAction} from '../App/AppState';
import {DataModelRoot} from '../DataModel/DataModelContext';
import {buildMultiSetDataModelActionNode, DataModelAtomicAction} from '../DataModel/DataModelAction';

export function mappingTableUIModelPaste(
  model: MappingTableUIModel,
  selection: TableCellRange,
  data: readonly (readonly string[])[],
  root: DataModelRoot,
): TableUIModelPasteResult | undefined {
  const dataRowSize = data.length;
  if (dataRowSize === 0) {
    return undefined;
  }
  const dataColumnSize = data[0].length;
  const pasteRowSize = Math.min(
    tableUIModelPasteRange(selection.row, dataRowSize, model.rows.length),
    model.rows.length - selection.row.start,
  );
  const pasteColumnSize = Math.min(
    tableUIModelPasteRange(selection.col, dataColumnSize, model.columns.length),
    model.columns.length - selection.col.start,
  );

  const actions: DataModelAtomicAction[] = [];
  for (let rowDataIndex = 0; rowDataIndex < pasteRowSize; rowDataIndex++) {
    const row = model.rows[selection.row.start + rowDataIndex];
    if (row) {
      for (let columnDataIndex = 0; columnDataIndex < pasteColumnSize; columnDataIndex++) {
        const columnIndex = selection.col.start + columnDataIndex;
        const cellUIModel = row.cells[columnIndex];
        const cellData = data[rowDataIndex % dataRowSize][columnDataIndex % dataColumnSize];
        const action = tableUIModelPasteCellAction(cellUIModel, cellData, root);
        if (action) {
          actions.push(action.action);
        }
      }
    }
  }

  // danglingRowsは変更不可のため、pasteもできない。

  const dataAction = buildMultiSetDataModelActionNode(model.dataContext, actions);

  return {
    action: dataAction && {type: 'data', action: dataAction},
    changedSelection: {
      row: {start: selection.row.start, size: pasteRowSize},
      col: {start: selection.col.start, size: pasteColumnSize},
    },
  };
}

export function mappingTableUIModelCopy(model: MappingTableUIModel, selection: TableCellRange): string[][] {
  const data: string[][] = [];
  const danglingRowSize =
    selection.row.size === undefined
      ? model.danglingRows.length
      : Math.max(0, selection.row.start + selection.row.size - model.rows.length);
  const rowSize = selection.row.size === undefined ? model.rows.length : selection.row.size - danglingRowSize;
  const columnSize = selection.col.size ?? model.columns.length;

  // rows loop
  for (let selectionRowIndex = 0; selectionRowIndex < rowSize; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    const rowData: string[] = [];
    for (let selectionColumnIndex = 0; selectionColumnIndex < columnSize; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      if (cell.isKey) {
        // TODO スキーマのバリデーションにも実装を追加
        throw new Error('mapping tableのカラムにkeyを指定するフィールドが存在してはいけない。');
      }
      rowData.push(tableUIModelStringToDataModelWithSchema(cell.schema.dataSchema, cell.data));
    }
    data.push(rowData);
  }

  // danglingRows loop
  const danglingRowStart = Math.max(0, selection.row.start - model.rows.length);
  for (let rowIndexOffset = 0; rowIndexOffset < danglingRowSize; rowIndexOffset++) {
    const row = model.danglingRows[danglingRowStart + rowIndexOffset];
    const rowData: string[] = [];
    for (let columnIndexOffset = 0; columnIndexOffset < columnSize; columnIndexOffset++) {
      const cell = row.cells[selection.col.start + columnIndexOffset];
      if (cell.isKey) {
        // TODO スキーマのバリデーションにも実装を追加
        throw new Error('mapping tableのカラムにkeyを指定するフィールドが存在してはいけない。');
      }
      rowData.push(tableUIModelStringToDataModelWithSchema(cell.schema.dataSchema, cell.data));
    }
    data.push(rowData);
  }

  return data;
}

interface CutResult {
  readonly action: AppAction;
  readonly data: string[][];
}

export function mappingTableUIModelCut(model: MappingTableUIModel, selection: TableCellRange): CutResult {
  return {
    action: mappingTableUIModelDelete(model, selection),
    data: mappingTableUIModelCopy(model, selection),
  };
}

export function mappingTableUIModelDelete(model: MappingTableUIModel, selection: TableCellRange): AppAction {
  const actions: DataModelAtomicAction[] = [];

  // TODO danglingも考慮
  const rowSize = Math.min(selection.row.size ?? model.rows.length, model.rows.length - selection.row.start);
  const columnSize = selection.col.size ?? model.columns.length;
  for (let selectionRowIndex = 0; selectionRowIndex < rowSize; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    for (let selectionColumnIndex = 0; selectionColumnIndex < columnSize; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      if (cell.isKey) {
        // TODO スキーマのバリデーションにも実装を追加
        throw new Error('mapping tableのカラムにkeyを指定するフィールドが存在してはいけない。');
      }
      actions.push({type: 'delete', dataContext: cell.dataContext});
    }
  }

  return {type: 'data', action: buildMultiSetDataModelActionNode(model.dataContext, actions)!};
}

export function mappingTableRowSize(model: MappingTableUIModel): number {
  return model.rows.length + model.danglingRows.length;
}
