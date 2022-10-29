import {AppAction} from '../App/AppState';
import {MappingTableUIModel, TableUIModel, UIModel} from './UIModelTypes';
import {textUIModelHandleInputForSchema, textUIModelSetText} from './TextUIModel';
import {dataModelIsBoolean, dataModelToString, emptyMapModel, setToMapDataModel} from '../DataModel/DataModel';
import {DataModel} from '../DataModel/DataModelTypes';
import {selectUIModelHandleInputForSchema, selectUIModelSetString} from './SelectUIModel';
import {
  DataModelRoot,
  mapDataModelContextPathForDataModel,
  pushDataModelContextPath,
} from '../DataModel/DataModelContext';
import {checkboxUIModelHandleInputWithSchema, checkboxUIModelSetStringValue} from './CheckboxUIModel';
import {numberUIModelHandleInputForSchema, numberUIModelSetText} from './NumberUIModel';
import {DataSchema, dataSchemaIsBoolean} from '../DataModel/DataSchema';
import {defaultDataModelForSchema} from '../DataModel/DataModelWithSchema';
import {UIModelContextMenuItem} from './UIModelCommon';

export interface TableCellPoint {
  readonly row: number;
  readonly col: number;
}

/**
 * 表をクリックしたポイントを表す値で、各価がundefinedであればheaderをクリックしたことを表す。
 */
export type PartialTableCellPoint = Partial<TableCellPoint>;

export interface TableRange {
  readonly start: number;

  /**
   * undefinedの場合は行(列)全体が範囲に入っていることを表す
   */
  readonly size: number | undefined;
}

export interface TableCellRange {
  readonly row: TableRange;
  readonly col: TableRange;
}

export interface TableUISelection {
  readonly origin: PartialTableCellPoint;
  readonly range: TableCellRange;
}

export function tableRangeContains(range: TableRange | undefined, target: number): boolean {
  if (!range) {
    return false;
  }

  if (range.size === undefined) {
    return true;
  }

  return target >= range.start && target < range.start + range.size;
}

export function isStartOfTableRange(range: TableRange | undefined, target: number): boolean {
  return !!range && target === range.start;
}

export function isEndOfTableRange(range: TableRange | undefined, target: number, maxSize: number): boolean {
  if (!range) {
    return false;
  }

  if (range.size === undefined) {
    return target === maxSize - 1;
  }

  return target === range.start + range.size - 1;
}

function makeRange(start: number, end: number): TableRange {
  if (start > end) {
    return {start: end, size: start - end + 1};
  } else {
    return {start, size: end - start + 1};
  }
}

export function selectingTableCellRange(
  startPoint: PartialTableCellPoint,
  currentPoint: PartialTableCellPoint,
): TableCellRange {
  return {
    row: startPoint.row === undefined ? {start: 0, size: undefined} : makeRange(startPoint.row, currentPoint.row ?? 0),
    col: startPoint.col === undefined ? {start: 0, size: undefined} : makeRange(startPoint.col, currentPoint.col ?? 0),
  };
}

export function tableUIModelPasteRange(selectionRange: TableRange, dataSize: number, maxSize: number): number {
  return Math.max(dataSize, Math.floor(selectionRange.size ?? maxSize / dataSize));
}

export interface TableUIModelPasteResult {
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

export function tableUIModelMakeNewRow(
  model: TableUIModel | MappingTableUIModel,
  defaultValues: ValueWithColumnIndex[],
  root: DataModelRoot,
): NewRow {
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
      case 'select': {
        if (typeof columnSchema.key === 'string') {
          const cellContext = pushDataModelContextPath(
            model.dataContext,
            mapDataModelContextPathForDataModel(rowData, columnSchema.key),
          );
          const result = selectUIModelHandleInputForSchema(columnSchema, defaultValue.value, cellContext, root);
          if (result !== undefined) {
            rowData = setToMapDataModel(rowData, columnSchema.key, result);
          }
        }
        break;
      }
      case 'number': {
        if (typeof columnSchema.key === 'string') {
          const result = numberUIModelHandleInputForSchema(columnSchema, defaultValue.value);
          if (result !== undefined) {
            rowData = setToMapDataModel(rowData, columnSchema.key, result);
          }
        }
        break;
      }
      case 'checkbox': {
        if (typeof columnSchema.key === 'string') {
          const result = checkboxUIModelHandleInputWithSchema(columnSchema, defaultValue.value);
          if (result !== undefined) {
            rowData = setToMapDataModel(rowData, columnSchema.key, result);
          }
          break;
        }
      }
    }
  }

  return {data: rowData, key};
}

export function tableUIModelPasteCellAction(
  cellUIModel: UIModel,
  cellData: string,
  root: DataModelRoot,
): AppAction | undefined {
  switch (cellUIModel.type) {
    case 'text':
      return textUIModelSetText(cellUIModel, cellData);
    case 'select':
      return selectUIModelSetString(cellUIModel, cellData, root);
    case 'checkbox':
      return checkboxUIModelSetStringValue(cellUIModel, cellData);
    case 'number':
      return numberUIModelSetText(cellUIModel, cellData);
    default:
      return undefined;
  }
}

export function tableUIModelPaste(
  model: TableUIModel,
  selection: TableCellRange,
  data: readonly (readonly string[])[],
  root: DataModelRoot,
): TableUIModelPasteResult | undefined {
  const dataRowSize = data.length;
  if (dataRowSize === 0) {
    return undefined;
  }
  const dataColumnSize = data[0].length;

  const actions: AppAction[] = [];

  const pasteRowSize = tableUIModelPasteRange(selection.row, dataRowSize, model.rows.length);
  const pasteColumnSize = Math.min(
    tableUIModelPasteRange(selection.col, dataColumnSize, model.columns.length),
    model.columns.length - selection.col.start,
  );
  for (let rowDataIndex = 0; rowDataIndex < pasteRowSize; rowDataIndex++) {
    const row = model.rows[selection.row.start + rowDataIndex];
    if (row) {
      for (let columnDataIndex = 0; columnDataIndex < pasteColumnSize; columnDataIndex++) {
        const columnIndex = selection.col.start + columnDataIndex;
        const cellUIModel = row.cells[columnIndex];
        const cellData = data[rowDataIndex % dataRowSize][columnDataIndex % dataColumnSize];
        const action = tableUIModelPasteCellAction(cellUIModel, cellData, root);
        if (action) {
          actions.push(action);
        }
      }
    } else {
      const {data: newRowData, key} = tableUIModelMakeNewRow(
        model,
        data[rowDataIndex].map((value, columnDataIndex) => ({
          columnIndex: columnDataIndex + selection.col.start,
          value,
        })),
        root,
      );
      actions.push({type: 'data', action: {type: 'push', data: newRowData, path: model.dataPath, key}});
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

export function tableUIModelCopyCell(cell: UIModel): string {
  if (cell.isKey) {
    return cell.value ?? '';
  } else {
    return tableUIModelStringToDataModelWithSchema(cell.schema?.dataSchema, cell.data);
  }
}

export function tableUIModelStringToDataModelWithSchema(
  dataSchema: DataSchema | undefined,
  data: DataModel | undefined,
): string {
  if (dataSchemaIsBoolean(dataSchema)) {
    const cellData = dataModelIsBoolean(data) ? data : false;
    return dataModelToString(cellData);
  } else {
    return dataModelToString(data);
  }
}

export function tableUIModelCopy(model: TableUIModel, selection: TableCellRange): string[][] {
  const data: string[][] = [];
  for (let selectionRowIndex = 0; selectionRowIndex < (selection.row.size ?? model.rows.length); selectionRowIndex++) {
    const rowData: string[] = [];
    const row = model.rows[selection.row.start + selectionRowIndex];
    data.push(rowData);
    const size = selection.col.size ?? model.columns.length;
    for (let selectionColumnIndex = 0; selectionColumnIndex < size; selectionColumnIndex++) {
      rowData.push(tableUIModelCopyCell(row.cells[selection.col.start + selectionColumnIndex]));
    }
  }
  return data;
}

interface CutResult {
  readonly action: AppAction;
  readonly data: string[][];
}

export function tableUIModelCut(model: TableUIModel, selection: TableCellRange): CutResult {
  return {
    action: tableUIModelDelete(model, selection),
    data: tableUIModelCopy(model, selection),
  };
}

export function tableUIModelDelete(model: TableUIModel, selection: TableCellRange): AppAction {
  const actions: AppAction[] = [];

  const selectionRowSize = selection.row.size ?? model.rows.length;
  const selectionColumnSize = selection.col.size ?? model.columns.length;
  for (let selectionRowIndex = 0; selectionRowIndex < selectionRowSize; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    for (let selectionColumnIndex = 0; selectionColumnIndex < selectionColumnSize; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      if (cell.isKey) {
        actions.push({
          type: 'data',
          action: {type: 'setKey', path: cell.parentDataPath, sourceKeyPointer: cell.selfPointer, key: null},
        });
      } else {
        actions.push({type: 'data', action: {type: 'delete', path: cell.dataPath}});
      }
    }
  }

  return {type: 'batch', actions};
}

export type TableUIModelMoveDirection = 'up' | 'right' | 'left' | 'down';

function increasePointValue(prev: number | undefined): number {
  // 値がマイナスでも強制的に1にする。 (headerクリック後(-1の時)の移動を想定)
  return prev === undefined ? 1 : prev + 1;
}

function decreasePointValue(prev: number | undefined): number | undefined {
  return prev === undefined ? undefined : prev - 1;
}

export function tableUIModelMoveSelection(
  prev: TableUISelection,
  direction: TableUIModelMoveDirection,
  rowSize: number,
  colSize: number,
): TableUISelection;
export function tableUIModelMoveSelection(
  prev: TableUISelection | undefined,
  direction: TableUIModelMoveDirection,
  rowSize: number,
  colSize: number,
): TableUISelection | undefined;
export function tableUIModelMoveSelection(
  prev: TableUISelection | undefined,
  direction: TableUIModelMoveDirection,
  rowSize: number,
  colSize: number,
): TableUISelection | undefined {
  if (!prev) {
    return undefined;
  }
  const {origin, range} = prev;
  if (range.col.size === 1 && range.row.size === 1) {
    switch (direction) {
      case 'up':
        if (origin.row === 0 || origin.row === undefined) {
          return prev;
        }
        return {
          origin: {row: origin.row - 1, col: origin.col},
          range: {row: {start: range.row.start - 1, size: range.row.size}, col: range.col},
        };
      case 'right':
        if (origin.col === undefined ? colSize <= 1 : origin.col + 1 >= colSize) {
          return prev;
        }
        return {
          origin: {row: origin.row, col: increasePointValue(origin.col)},
          range: {row: range.row, col: {start: increasePointValue(range.col.start), size: range.col.size}},
        };
      case 'left':
        if (origin.col === 0 || origin.col === undefined) {
          return prev;
        }
        return {
          origin: {row: origin.row, col: origin.col - 1},
          range: {row: range.row, col: {start: range.col.start - 1, size: range.col.size}},
        };
      case 'down':
        if (origin.row !== undefined && origin.row + 1 >= rowSize) {
          return prev;
        }
        return {
          origin: {row: increasePointValue(origin.row), col: origin.col},
          range: {row: {start: increasePointValue(range.row.start), size: range.row.size}, col: range.col},
        };
    }
  } else {
    // TODO
    return prev;
  }
}

function initialData(model: TableUIModel): DataModel {
  return defaultDataModelForSchema(model.schema.dataSchema);
}

export function tableUIModelAddRowBeforeAction(model: TableUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      path: model.dataPath,
      after: index === 0 ? undefined : model.rows[index - 1].pointer,
      data: initialData(model),
    },
  };
}

export function tableUIModelAddRowAfterAction(model: TableUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      path: model.dataPath,
      after: model.rows[index]?.pointer,
      data: initialData(model),
    },
  };
}

export function tableUIModelDeleteRowsBySelection(model: TableUIModel, selection: TableUISelection): AppAction {
  const actions: AppAction[] = [];
  for (let i = 0; i < (selection.range.row.size ?? model.rows.length); i++) {
    actions.push({
      type: 'data',
      action: {
        type: 'delete',
        path: model.dataPath,
        at: model.rows[i + selection.range.row.start].pointer,
      },
    });
  }
  return {type: 'batch', actions};
}

export function tableUIModelContextMenus(
  model: TableUIModel,
  rowIndex: number,
  selection: TableUISelection | undefined,
): UIModelContextMenuItem[] {
  // console.log('xxxx tableUIModelContextMenus', model, rowIndex);
  const items: UIModelContextMenuItem[] = [];

  items.push({label: 'Insert above', action: tableUIModelAddRowBeforeAction(model, rowIndex)});
  items.push({label: 'Insert below', action: tableUIModelAddRowAfterAction(model, rowIndex)});

  if (selection && selection.range.row.size !== undefined) {
    const deleteLabel = selection.range.row.size === 1 ? 'Delete row' : `Delete ${selection.range.row.size} rows`;
    items.push({
      label: deleteLabel,
      action: tableUIModelDeleteRowsBySelection(model, selection),
    });
  }

  return items;
}
