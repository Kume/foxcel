import {AppAction} from '../App/AppState';
import {TableUIModel} from './UIModelTypes';
import {textUIModelHandleInputForSchema, textUIModelSetText} from './TextUIModel';
import {dataModelToString, emptyMapModel, setToMapDataModel} from '../DataModel/DataModel';
import {DataModel} from '../DataModel/DataModelTypes';

export interface TableCellPoint {
  readonly row: number;
  readonly col: number;
}

export interface TableRange {
  readonly start: number;
  readonly size: number;
}

export interface TableCellRange {
  readonly row: TableRange;
  readonly col: TableRange;
}

export function tableRangeContains(range: TableRange | undefined, target: number): boolean {
  return !!range && target >= range.start && target < range.start + range.size;
}

function makeRange(start: number, end: number): TableRange {
  if (start > end) {
    return {start: end, size: start - end + 1};
  } else {
    return {start, size: end - start + 1};
  }
}

export function selectingTableCellRange(startPoint: TableCellPoint, currentPoint: TableCellPoint): TableCellRange {
  return {row: makeRange(startPoint.row, currentPoint.row), col: makeRange(startPoint.col, currentPoint.col)};
}

export function pasteRange(selectionRange: TableRange, dataSize: number): number {
  return Math.max(dataSize, Math.floor(selectionRange.size / dataSize));
}

interface PasteResult {
  readonly action: AppAction;
  readonly changedSelection?: TableCellRange;
}

interface ValueWithColumnIndex {
  columnIndex: number;
  value: string | null;
}

interface NewRow {
  readonly key: string | null | undefined;
  readonly data: DataModel;
}

function makeNewRow(model: TableUIModel, defaultValues: ValueWithColumnIndex[]): AppAction {
  let rowData = emptyMapModel;
  let key: string | null | undefined;

  for (const defaultValue of defaultValues) {
    const columnSchema = model.schema.contents[defaultValue.columnIndex];
    switch (columnSchema.type) {
      case 'text': {
        const result = textUIModelHandleInputForSchema(columnSchema, defaultValue.value);
        if (result.type === 'key') {
          key = result.key;
        } else if (typeof columnSchema.key === 'string') {
          rowData = setToMapDataModel(rowData, columnSchema.key, result.value);
        }
        break;
      }
    }
  }

  return {type: 'data', action: {type: 'push', data: rowData, path: model.dataPath, key}};
}

export function pasteForTableUIModel(
  model: TableUIModel,
  selection: TableCellRange,
  data: readonly (readonly string[])[],
): PasteResult | undefined {
  const dataRowSize = data.length;
  if (dataRowSize === 0) {
    return undefined;
  }
  const dataColumnSize = data[0].length;

  const actions: AppAction[] = [];

  const pasteRowSize = pasteRange(selection.row, dataRowSize);
  const pasteColumnSize = Math.min(
    pasteRange(selection.col, dataColumnSize),
    model.columns.length - selection.col.start,
  );
  for (let rowDataIndex = 0; rowDataIndex < pasteRowSize; rowDataIndex++) {
    const row = model.rows[selection.row.start + rowDataIndex];
    if (row) {
      for (let columnDataIndex = 0; columnDataIndex < pasteColumnSize; columnDataIndex++) {
        const columnIndex = selection.col.start + columnDataIndex;
        const cellUIModel = row.cells[columnIndex];
        const cellData = data[rowDataIndex % dataRowSize][columnDataIndex % dataColumnSize];
        switch (cellUIModel.type) {
          case 'text':
            actions.push(textUIModelSetText(cellUIModel, cellData));
            break;
        }
      }
    } else {
      actions.push(
        makeNewRow(
          model,
          data[rowDataIndex].map((value, columnDataIndex) => ({
            columnIndex: columnDataIndex + selection.col.start,
            value,
          })),
        ),
      );
    }
  }

  return {
    action: {type: 'batch', actions},
    changedSelection: {
      row: {start: selection.row.start, size: pasteRowSize},
      col: {start: selection.col.start, size: pasteColumnSize},
    },
  };
}

export function copyFromTableUIModel(model: TableUIModel, selection: TableCellRange): string[][] {
  const data: string[][] = [];
  for (let selectionRowIndex = 0; selectionRowIndex < selection.row.size; selectionRowIndex++) {
    const rowData: string[] = [];
    const row = model.rows[selection.row.start + selectionRowIndex];
    data.push(rowData);
    for (let selectionColumnIndex = 0; selectionColumnIndex < selection.col.size; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      if (cell.isKey) {
        rowData.push(cell.value ?? '');
      } else {
        rowData.push(dataModelToString(cell.data));
      }
    }
  }
  return data;
}

interface CutResult {
  readonly action: AppAction;
  readonly data: string[][];
}

export function cutFromTableUIModel(model: TableUIModel, selection: TableCellRange): CutResult {
  const actions: AppAction[] = [];

  for (let selectionRowIndex = 0; selectionRowIndex < selection.row.size; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    for (let selectionColumnIndex = 0; selectionColumnIndex < selection.col.size; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      switch (cell.type) {
        case 'text':
          actions.push(textUIModelSetText(cell, null));
          break;
      }
    }
  }

  return {
    action: {type: 'batch', actions},
    data: copyFromTableUIModel(model, selection),
  };
}
