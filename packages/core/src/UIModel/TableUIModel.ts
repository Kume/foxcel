import {AppAction} from '../App/AppState';
import {MappingTableUIModel, TableUIModel, UIModel} from './UIModelTypes';
import {textUIModelHandleInputForSchema, textUIModelSetText} from './TextUIModel';
import {
  dataModelIsBoolean,
  dataModelToString,
  emptyListModel,
  emptyMapModel,
  insertToDataModel,
  mapOrListDataSize,
  setToMapDataModel,
} from '../DataModel/DataModel';
import {DataModel, ListDataModel, MapDataModel} from '../DataModel/DataModelTypes';
import {selectUIModelHandleInputForSchema, selectUIModelSetString} from './SelectUIModel';
import {DataModelContext, DataModelRoot} from '../DataModel/DataModelContext';
import {checkboxUIModelHandleInputWithSchema, checkboxUIModelSetStringValue} from './CheckboxUIModel';
import {numberUIModelHandleInputForSchema, numberUIModelSetText} from './NumberUIModel';
import {DataSchema, dataSchemaIsBoolean, DataSchemaType} from '../DataModel/DataSchema';
import {UIModelContextMenuItem} from './UIModelCommon';
import {rangeBySize} from '../common/utils';
import {buildMultiSetDataModelActionNode, DataModelAction, DataModelAtomicAction} from '../DataModel/DataModelAction';

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

  const context = DataModelContext.deserialize(model.dataContext, root);
  for (const defaultValue of defaultValues) {
    const columnSchema = model.schema.contents[defaultValue.columnIndex];
    switch (columnSchema.type) {
      case 'text': {
        const result = textUIModelHandleInputForSchema(columnSchema, defaultValue.value);
        switch (result.type) {
          case 'empty':
            break;
          case 'key':
            key = result.key;
            break;
          case 'value':
            if (typeof columnSchema.key === 'string') {
              rowData = setToMapDataModel(rowData, columnSchema.key, result.value);
            }
            break;
        }
        break;
      }
      case 'select': {
        if (typeof columnSchema.key === 'string') {
          const cellContext = context.pushMapKey(columnSchema.key);
          const result = selectUIModelHandleInputForSchema(columnSchema, defaultValue.value, cellContext);
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

export function tableUIModelPasteCellAction(cellUIModel: UIModel, cellData: string, root: DataModelRoot) {
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

  const pasteRowSize = tableUIModelPasteRange(selection.row, dataRowSize, model.rows.length);
  const pasteColumnSize = Math.min(
    tableUIModelPasteRange(selection.col, dataColumnSize, model.columns.length),
    model.columns.length - selection.col.start,
  );
  const setRowSize = Math.min(pasteRowSize, model.rows.length - selection.row.start);
  const actions: DataModelAtomicAction[] = [];
  for (let rowIndex = 0; rowIndex < setRowSize; rowIndex++) {
    const row = model.rows[selection.row.start + rowIndex];
    for (let columnIndex = 0; columnIndex < pasteColumnSize; columnIndex++) {
      const cellUIModel = row.cells[selection.col.start + columnIndex];
      const cellData = data[rowIndex % dataRowSize][columnIndex % dataColumnSize];
      const action = tableUIModelPasteCellAction(cellUIModel, cellData, root);
      if (action) {
        actions.push(action.action);
      }
    }
  }

  const pushRowSize = pasteRowSize - setRowSize;
  const pushValuesData: {readonly value: DataModel; readonly key?: string}[] = [];
  for (let rowIndex = 0; rowIndex < pushRowSize; rowIndex++) {
    const {data: newRowData, key} = tableUIModelMakeNewRow(
      model,
      data[(rowIndex + setRowSize) % dataRowSize].map((value, columnIndex) => ({
        columnIndex: columnIndex + selection.col.start,
        value,
      })),
      root,
    );
    pushValuesData.push({value: newRowData, key: key ?? undefined});
  }

  return {
    action: {
      type: 'data',
      action: {
        type: 'batch',
        setMultiple: buildMultiSetDataModelActionNode(model.dataContext, actions),
        push: {type: 'pushValues', data: pushValuesData, dataContext: model.dataContext},
      },
    },
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
  const actions: DataModelAtomicAction[] = [];

  const selectionRowSize = selection.row.size ?? model.rows.length;
  const selectionColumnSize = selection.col.size ?? model.columns.length;
  for (let selectionRowIndex = 0; selectionRowIndex < selectionRowSize; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    for (let selectionColumnIndex = 0; selectionColumnIndex < selectionColumnSize; selectionColumnIndex++) {
      const cell = row.cells[selection.col.start + selectionColumnIndex];
      if (cell.isKey) {
        actions.push({type: 'setKey', dataContext: cell.dataContext, key: null});
      } else {
        actions.push({type: 'delete', dataContext: cell.dataContext});
      }
    }
  }

  return {type: 'data', action: buildMultiSetDataModelActionNode(model.dataContext, actions)!};
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

function initialRowData(model: TableUIModel): DataModel {
  // 今のところ行に利用できるデータはMapのみ
  return emptyMapModel;
}

function initialData(model: TableUIModel): ListDataModel | MapDataModel {
  // 主に新規追加時に作成するものなので、下手なデフォルト値が設定されていると困るので固定で空のオブジェクトを作る
  // TODO スキーマパース時にデフォルト値が指定されていたらエラーにする
  // TODO contentListも同様にする
  switch (model.schema.dataSchema.t) {
    case DataSchemaType.List:
      return emptyListModel;
    case DataSchemaType.Map:
      return emptyMapModel;
  }
}

export function tableUIModelAddRowBeforeAction(model: TableUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      dataContext: model.dataContext,
      after: index === 0 ? undefined : index - 1,
      data: initialRowData(model),
    },
  };
}

export function tableUIModelAddRowAfterAction(model: TableUIModel, index: number): AppAction {
  return {
    type: 'data',
    action: {
      type: 'insert',
      dataContext: model.dataContext,
      after: index,
      data: initialRowData(model),
    },
  };
}

export function tableUIModelDeleteRowsBySelection(model: TableUIModel, selection: TableUISelection): AppAction {
  return {
    type: 'data',
    action: {
      type: 'delete',
      dataContext: model.dataContext,
      at: rangeBySize(selection.range.row.start, selection.range.row.size ?? model.rows.length),
    },
  };
}

export function tableUIModelContextMenus(
  model: TableUIModel,
  rowIndex: number,
  selection: TableUISelection | undefined,
): UIModelContextMenuItem[] {
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

export function tableUIModelAddRows(
  model: TableUIModel,
  rowsText: string,
): {t: 'action'; action: AppAction} | {t: 'error'; message: string} {
  const rows = Number.parseInt(rowsText);
  if (!(Number.isFinite(rows) && rows > 0)) {
    return {t: 'error', message: '行数指定が不正です。'};
  }
  return {
    t: 'action',
    action: {type: 'data', action: tableUIModelAddRowsDataAction(model, rows)},
  };
}

function tableUIModelAddRowsDataAction(model: TableUIModel, rows: number): DataModelAction {
  const newModels = [...Array(rows)].map(() => initialRowData(model));

  if (model.data === undefined) {
    const emptyData = initialData(model);
    const initial = insertToDataModel(
      emptyData,
      undefined,
      DataModelContext.createRoot({model: emptyData, schema: model.schema.dataSchema}),
      {models: newModels},
    );
    return {type: 'set', dataContext: model.dataContext, data: initial ?? emptyData};
  } else {
    const size = mapOrListDataSize(model.data);
    return {
      type: 'insertValues',
      dataContext: model.dataContext,
      after: size === 0 ? undefined : size - 1,
      data: newModels,
    };
  }
}
