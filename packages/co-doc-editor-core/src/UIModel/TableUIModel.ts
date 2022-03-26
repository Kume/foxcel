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

export function tableUIModelPasteRange(selectionRange: TableRange, dataSize: number): number {
  return Math.max(dataSize, Math.floor(selectionRange.size / dataSize));
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
): AppAction {
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

  return {type: 'data', action: {type: 'push', data: rowData, path: model.dataPath, key}};
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

  const pasteRowSize = tableUIModelPasteRange(selection.row, dataRowSize);
  const pasteColumnSize = Math.min(
    tableUIModelPasteRange(selection.col, dataColumnSize),
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
      actions.push(
        tableUIModelMakeNewRow(
          model,
          data[rowDataIndex].map((value, columnDataIndex) => ({
            columnIndex: columnDataIndex + selection.col.start,
            value,
          })),
          root,
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
  for (let selectionRowIndex = 0; selectionRowIndex < selection.row.size; selectionRowIndex++) {
    const rowData: string[] = [];
    const row = model.rows[selection.row.start + selectionRowIndex];
    data.push(rowData);
    for (let selectionColumnIndex = 0; selectionColumnIndex < selection.col.size; selectionColumnIndex++) {
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
  const actions: AppAction[] = [];

  for (let selectionRowIndex = 0; selectionRowIndex < selection.row.size; selectionRowIndex++) {
    const row = model.rows[selection.row.start + selectionRowIndex];
    for (let selectionColumnIndex = 0; selectionColumnIndex < selection.col.size; selectionColumnIndex++) {
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

  return {
    action: {type: 'batch', actions},
    data: tableUIModelCopy(model, selection),
  };
}
