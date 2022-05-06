import {
  dataPathComponentIsIndexOrKey,
  dataPathComponentIsListIndex,
  dataPathComponentIsListIndexLike,
  dataPathComponentIsMapKey,
  dataPathComponentIsMapKeyLike,
  dataPathComponentIsPointer,
  dataPathComponentToMapKey,
  dataPathLength,
  ForwardDataPath,
  ForwardDataPathComponent,
  dataPathComponentToListIndex,
  dataPathComponentToListIndexOrFail,
  MultiDataPath,
  shiftDataPath,
  headDataPathComponent,
  tailDataPathComponent,
  DataPathComponent,
} from './DataPath';
import {
  BooleanDataModel,
  DataCollectionItem,
  DataModel,
  DataModelType,
  DataPointer,
  FloatDataModel,
  IntegerDataModel,
  ListDataModel,
  MapDataModel,
  NullDataModel,
  PublicListDataItem,
  PublicMapDataItem,
  StringDataModel,
} from './DataModelTypes';
import {DataSchemaContext} from './DataSchema';
import {DataModelOperationError} from './errors';
import {ConditionConfig} from '..';
import {defaultDataModelForSchema} from './DataModelWithSchema';

let currentId = 0;
export function generateDataModelId(): number {
  return currentId++;
}

export function dataModelTypeToLabel(type: DataModelType): string {
  return DataModelType[type];
}

export const emptyMapModel: MapDataModel = {t: DataModelType.Map, v: []};
export const emptyListModel: ListDataModel = [];
export const nullDataModel = null;
export const trueDataModel: BooleanDataModel = true;
export const falseDataModel: BooleanDataModel = false;

export function dataModelType(model: DataModel): DataModelType {
  switch (typeof model) {
    case 'number':
      if (Number.isInteger(model)) {
        return DataModelType.Integer;
      } else {
        return DataModelType.Float;
      }
    case 'boolean':
      return DataModelType.Boolean;
    case 'string':
      return DataModelType.String;
    case 'object':
      if (model === null) {
        return DataModelType.Null;
      }
      if (Array.isArray(model)) {
        return DataModelType.List;
      }
      return DataModelType.Map;
  }
}

export function stringToDataModel(value: string): StringDataModel {
  return value;
}

export function nullableStringToDataModel(value: string | null): StringDataModel | NullDataModel {
  return value;
}

export function numberToIntegerDataModel(value: number): IntegerDataModel {
  return value;
}

export function stringToNumberDataModel(value: string): IntegerDataModel | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function booleanToDataModel(value: boolean): BooleanDataModel {
  return value;
}

export function unknownToDataModel(value: unknown): DataModel {
  if (value === null || value === undefined) {
    return null;
  }
  switch (typeof value) {
    case 'number':
    case 'boolean':
    case 'string':
      return value;
    case 'object':
      if (Array.isArray(value)) {
        return value.map((v) => [generateDataModelId(), unknownToDataModel(v)]);
      } else {
        return {
          t: DataModelType.Map,
          v: Object.keys(value!)
            .filter((k) => (value as any)[k] !== undefined)
            .map((k) => [k, generateDataModelId(), unknownToDataModel((value as any)[k])]),
        };
      }
    default:
      throw new Error('Invalid data type');
  }
}

export function dataModelEquals(a: DataModel, b: DataModel): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return a.every(([, aValue], index) => dataModelEquals(aValue, getListDataAt(b, index)!));
  } else {
    if (Array.isArray(b)) {
      return false;
    }
    if (a.v.length !== b.v.length) {
      return false;
    }
    return a.v.every(
      (_, i) =>
        getMapKeyAtIndex(a, i) === getMapKeyAtIndex(b, i) &&
        dataModelEquals(getMapDataAtIndex(a, i)!, getMapDataAtIndex(b, i)!),
    );
  }
}

export function dataModelEqualsToUnknown(model: DataModel, value: unknown): boolean {
  if (typeof model !== 'object' || typeof value !== 'object' || model === null || value === null) {
    return model === value;
  }
  if (Array.isArray(model)) {
    if (!Array.isArray(value)) {
      return false;
    }
    if (model.length !== value.length) {
      return false;
    }
    return model.every(([, modelChild], index) => dataModelEqualsToUnknown(modelChild, value[index]));
  }
  if (Array.isArray(value)) {
    return false;
  }
  const valueKeys = Object.keys(value);
  const map = mapDataModelToJsMap(model);
  if (valueKeys.length !== map.size) {
    return false;
  }
  return valueKeys.every((key) => dataModelEqualsToUnknown(map.get(key)!, (value as any)[key]));
}

export function dataModelToJson(model: DataModel): any {
  if (typeof model !== 'object' || model === null) {
    return model;
  }
  if (Array.isArray(model)) {
    return model.map(([, v]) => dataModelToJson(v));
  }
  const map: {[key: string]: any} = {};
  model.v.forEach(([key, value]) => {
    if (key !== null && map[key] === undefined) {
      map[key] = dataModelToJson(value);
    }
  });
  return map;
}

export function dataModelToString(model: DataModel | undefined): string {
  if (dataModelIsString(model)) {
    return stringDataModelToString(model);
  } else if (dataModelIsInteger(model)) {
    return numberDataModelToNumber(model).toString();
  } else if (dataModelIsMapOrList(model)) {
    return dataModelToJson(model);
  } else if (dataModelIsBoolean(model)) {
    return model ? 'TRUE' : 'FALSE';
  } else if (dataModelIsNull(model)) {
    return 'NULL';
  } else {
    return '';
  }
}

export function dataModelToLabelString(model: DataModel | undefined): string {
  if (dataModelIsString(model)) {
    return stringDataModelToString(model);
  } else if (dataModelIsInteger(model)) {
    return numberDataModelToNumber(model).toString();
  } else if (dataModelIsMapOrList(model)) {
    if (dataModelIsList(model)) {
      return '[List]';
    } else {
      return '{Object}';
    }
  } else if (dataModelIsBoolean(model)) {
    return model ? 'TRUE' : 'FALSE';
  } else if (dataModelIsNull(model)) {
    return 'NULL';
  } else {
    return '';
  }
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function setToDataModel(
  path: ForwardDataPath,
  value: DataModel,
  _to: DataModel,
  schema: DataSchemaContext | undefined,
): DataModel | undefined {
  // TODO データスキーマが存在していて、現在のデータがスキーマと不一致だったらスキーマを優先して置き換えるように修正すべき

  if (dataPathLength(path) === 0) {
    return dataModelEquals(value, _to) ? undefined : value;
  }
  let __to: DataModel | undefined = _to;
  if (!dataModelIsMapOrList(__to)) {
    __to = schema && defaultDataModelForSchema(schema.currentSchema);
    if (!__to || !dataModelIsMap(__to)) {
      throw new DataModelOperationError(
        `Cannot set data to ${__to ? dataModelTypeToLabel(dataModelType(__to)) : 'undefined'}`,
      );
    }
  }
  if (dataModelIsList(__to)) {
    return setToListDataRecursive(__to, path, schema, (nextPath, childData, childSchema) =>
      setToDataModel(nextPath, value, childData, childSchema),
    );
  }
  const to = __to;
  return setToMapDataRecursive(
    to,
    path,
    schema,
    (nextPath, childData, childSchema) => setToDataModel(nextPath, value, childData, childSchema),
    (key, schema) => {
      const pathLength = dataPathLength(path);
      if (typeof key !== 'string') {
        // TODO onKeyMissingコールバック呼び出し前で判定すべき?要調査
        throw new DataModelOperationError('key is undefined');
      }
      if (pathLength === 1) {
        return forceAddToMapData(to, value, key);
      }
      if (pathLength > 1 && schema) {
        const defaultData = defaultDataModelForSchema(schema.currentSchema);
        const newModel = setToDataModel(shiftDataPath(path), value, defaultData, schema) ?? emptyMapModel;
        return forceAddToMapData(to, newModel, key);
      }
      throw new DataModelOperationError('Cannot set data to empty value');
    },
  );
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function setKeyToDataModel(
  path: ForwardDataPath,
  sourceKeyPointer: DataPointer,
  key: string | null,
  to: DataModel,
  schema: DataSchemaContext | undefined,
): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    if (dataModelIsMap(to)) {
      const index = getMapDataIndexForPointer(to, sourceKeyPointer);
      if (index === undefined) {
        return undefined;
      }
      const sourceKey = getMapKeyAtIndex(to, index);
      if (sourceKey === key) {
        return undefined;
      }
      // indexがundefinedではないので、getMapDataAtIndexの結果は必ずundefinedにならない
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return forceSetToMapDataForIndex(to, getMapDataAtIndex(to, index)!, index, key);
    } else {
      return undefined;
    }
  } else {
    if (dataModelIsList(to)) {
      return setToListDataRecursive(to, path, schema, (nextPath, childData, childSchema) =>
        setKeyToDataModel(nextPath, sourceKeyPointer, key, childData, childSchema),
      );
    } else if (dataModelIsMap(to)) {
      return setToMapDataRecursive(to, path, schema, (nextPath, childData, childSchema) =>
        setKeyToDataModel(nextPath, sourceKeyPointer, key, childData, childSchema),
      );
    } else {
      return undefined;
    }
  }
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function insertToDataModel(
  path: ForwardDataPath,
  after: DataPointer | undefined,
  value: DataModel,
  to: DataModel,
  schema: DataSchemaContext | undefined,
): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    if (dataModelIsMap(to)) {
      if (after === undefined) {
        return forceInsertToMapData(to, value, 0, null);
      }
      const index = getMapDataIndexForPointer(to, after);
      if (index === undefined) {
        return undefined;
      }
      return forceInsertToMapData(to, value, index + 1, null);
    } else if (dataModelIsList(to)) {
      if (after === undefined) {
        return forceInsertToListData(to, value, 0);
      }
      const index = getListDataIndexForPointer(to, after);
      if (index === undefined) {
        return undefined;
      }
      return forceInsertToListData(to, value, index + 1);
    } else {
      return undefined;
    }
  } else {
    if (dataModelIsList(to)) {
      return setToListDataRecursive(to, path, schema, (nextPath, childData, childSchema) =>
        insertToDataModel(nextPath, after, value, childData, childSchema),
      );
    } else if (dataModelIsMap(to)) {
      return setToMapDataRecursive(to, path, schema, (nextPath, childData, childSchema) =>
        insertToDataModel(nextPath, after, value, childData, childSchema),
      );
    } else {
      return undefined;
    }
  }
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function pushToDataModel(
  path: ForwardDataPath,
  value: DataModel,
  to: DataModel,
  schema?: DataSchemaContext,
  key?: string,
): DataModel | undefined {
  const pathLength = dataPathLength(path);

  if (!dataModelIsMapOrList(to)) {
    throw new DataModelOperationError(`Cannot push data to ${dataModelTypeToLabel(dataModelType(to))}`);
  }
  if (dataModelIsList(to)) {
    if (pathLength === 0) {
      return pushToListData(to, value);
    } else {
      return setToListDataRecursive(to, path, schema, (nextPath, childData, childSchema) =>
        pushToDataModel(nextPath, value, childData, childSchema, key),
      );
    }
  }
  if (pathLength === 0) {
    return pushToMapData(to, value, key);
  } else {
    return setToMapDataRecursive(
      to,
      path,
      schema,
      (nextPath, childData, childSchema) => pushToDataModel(nextPath, value, childData, childSchema, key),
      () => {
        throw new DataModelOperationError('Cannot push data to empty value');
      },
    );
  }
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function deleteFromDataModel(
  path: ForwardDataPath,
  at: DataPointer | undefined,
  from: DataModel,
  schema: DataSchemaContext | undefined,
): DataModel | undefined {
  const pathLength = dataPathLength(path);
  if (pathLength === 0) {
    if (!at) {
      return undefined;
    }

    if (dataModelIsMap(from)) {
      const index = getMapDataIndexForPointer(from, at);
      if (index === undefined) {
        return undefined;
      }
      return forceDeleteFromMapDataAt(from, index);
    } else if (dataModelIsList(from)) {
      const index = getListDataIndexForPointer(from, at);
      if (index === undefined) {
        return undefined;
      }
      return forceDeleteFromListDataAt(from, index);
    } else {
      return undefined;
    }
  }

  if (!at && pathLength === 1) {
    const pathTail = tailDataPathComponent(path);
    if (dataModelIsMap(from)) {
      const deleted = deleteFromMapDataAtPathComponent(from, pathTail);
      return from === deleted ? undefined : deleted;
    } else if (dataModelIsList(from)) {
      const deleted = deleteFromListDataAtPathComponent(from, pathTail);
      return from === deleted ? undefined : deleted;
    } else {
      return undefined;
    }
  }

  if (dataModelIsList(from)) {
    return setToListDataRecursive(from, path, schema, (nextPath, childData, childSchema) =>
      deleteFromDataModel(nextPath, at, childData, childSchema),
    );
  } else if (dataModelIsMap(from)) {
    return setToMapDataRecursive(from, path, schema, (nextPath, childData, childSchema) =>
      deleteFromDataModel(nextPath, at, childData, childSchema),
    );
  } else {
    return undefined;
  }
}

export function getFromDataModelForPathComponent(
  model: DataModel | undefined,
  pathComponent: ForwardDataPathComponent,
): DataModel | undefined {
  if (!model) {
    return undefined;
  }
  if (!dataModelIsMapOrList(model)) {
    return undefined;
  }
  if (dataModelIsList(model)) {
    if (!dataPathComponentIsListIndexLike(pathComponent)) {
      return undefined;
    }
    const index = dataPathComponentToListIndex(pathComponent);
    return getListDataAt(model, index);
  } else {
    const {index} = getMapKeyAndIndex(model, pathComponent);
    return index === undefined ? undefined : getMapDataAtIndex(model, index);
  }
}

export function getFromDataModel(model: DataModel, path: ForwardDataPath): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    return model;
  }
  const headPathComponent = headDataPathComponent(path);
  const childModel = getFromDataModelForPathComponent(model, headPathComponent);
  return childModel && getFromDataModel(childModel, shiftDataPath(path));
}

type CreateNextChildData = (
  nextPath: ForwardDataPath,
  childData: DataModel,
  childSchema: DataSchemaContext | undefined,
) => DataModel | undefined;

//#region For ListDataModel
export function getListDataAt(list: ListDataModel, at: number): DataModel | undefined {
  return list[at][1];
}

export function getListItemAt(list: ListDataModel, at: number): PublicListDataItem | undefined {
  if (list[at] === undefined) {
    return undefined;
  }
  const [id, value] = list[at];
  return [value, {i: at, d: id}, at];
}

export function getListDataPointerAt(list: ListDataModel, index: number): DataPointer | undefined {
  const id = getListDataIdAtIndex(list, index);
  return id === undefined ? undefined : {i: index, d: id};
}

export function getListDataIdAtIndex(list: ListDataModel, index: number): number | undefined {
  return list[index]?.[0];
}

export function getListDataPointerByPathComponent(
  list: ListDataModel,
  pathComponent: ForwardDataPathComponent,
): DataPointer | undefined {
  const index = getListDataIndexByPathComponent(list, pathComponent);
  return index === undefined ? undefined : getListDataPointerAt(list, index);
}

export function getListDataIndexByPathComponent(
  list: ListDataModel,
  pathComponent: ForwardDataPathComponent,
): number | undefined {
  if (dataPathComponentIsListIndexLike(pathComponent)) {
    return dataPathComponentToListIndex(pathComponent);
  } else if (dataPathComponentIsPointer(pathComponent)) {
    return pathComponent.i;
  } else {
    return undefined;
  }
}

export function getListDataIndexForPointer(list: ListDataModel, pointer: DataPointer): number | undefined {
  if (list[pointer.i][0] === pointer.d) {
    return pointer.i;
  }
  return list.findIndex((id) => pointer.d);
}

export function listDataSize(list: ListDataModel): number {
  return list.length;
}

export function setToListDataAt(list: ListDataModel, value: DataModel, at: number): ListDataModel {
  const childData = getListDataAt(list, at);
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  return dataModelEquals(childData, value) ? list : forceSetToListData(list, value, at);
}

function forceSetToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  const v = [...list];
  v[index] = [v[index][0], value];
  return v;
}

function forceInsertToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  return [...list.slice(0, index), [generateDataModelId(), value], ...list.slice(index)];
}

export function pushToListData(list: ListDataModel, value: DataModel): ListDataModel {
  return [...list, [generateDataModelId(), value]];
}

function forceDeleteFromListDataAt(list: ListDataModel, index: number): ListDataModel {
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

export function deleteFromListDataAtPathComponent(
  list: ListDataModel,
  pathComponent: DataPathComponent,
): ListDataModel {
  if (dataPathComponentIsListIndexLike(pathComponent)) {
    const index = dataPathComponentToListIndex(pathComponent);
    if (index < 0 || index >= listDataSize(list)) {
      return list;
    }
    return forceDeleteFromListDataAt(list, index);
  }
  if (dataPathComponentIsPointer(pathComponent)) {
    const index = getListDataIndexForPointer(list, pathComponent);
    return index === undefined ? list : forceDeleteFromListDataAt(list, index);
  }
  return list;
}

function setToListDataRecursive(
  list: ListDataModel,
  path: ForwardDataPath,
  schema: DataSchemaContext | undefined,
  createNextChildData: CreateNextChildData,
): ListDataModel | undefined {
  const index = dataPathComponentToListIndexOrFail(headDataPathComponent(path));
  const childData = getListDataAt(list, index);
  const childSchema = schema && schema.getListChild();
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  const nextChildData = createNextChildData(shiftDataPath(path), childData, childSchema);
  return nextChildData === undefined ? undefined : forceSetToListData(list, nextChildData, index);
}

export function mapListDataModel<T>(
  list: ListDataModel,
  mapper: (item: DataModel, index: number, id: number) => T,
): T[] {
  return list.map(([id, item], index) => mapper(item, index, id));
}

export function findListDataModel(
  list: ListDataModel,
  match: (item: DataModel, pointer: DataPointer, index: number) => boolean,
): number | undefined {
  return list.findIndex(([id, item], index) => match(item, {i: index, d: id}, index));
}

export function* eachListDataItem(list: ListDataModel): Generator<PublicListDataItem, void> {
  for (let i = 0; i < listDataSize(list); i++) {
    const [id, value] = list[i];
    yield [value, {i, d: id}, i];
  }
}

export function mapListDataModelWithPointer<T>(
  list: ListDataModel,
  mapper: (item: DataModel, pointer: DataPointer, index: number) => T,
): T[] {
  return list.map(([id, item], index) => mapper(item, {i: index, d: id}, index));
}

//#endregion For ListDataModel

//#region For MapDataModel
export function findMapDataIndexOfKey(map: MapDataModel, key: string): number | undefined {
  for (let i = 0; i < mapDataSize(map); i++) {
    if (getMapKeyAtIndex(map, i) === key) {
      return i;
    }
  }
  return undefined;
}

export function getMapDataAt(map: MapDataModel, key: string): DataModel | undefined {
  const index = findMapDataIndexOfKey(map, key);
  return index === undefined ? undefined : getMapDataAtIndex(map, index);
}

export function getMapItemAtIndex(map: MapDataModel, index: number): PublicMapDataItem | undefined {
  const rawItem = map.v[index];
  if (rawItem === undefined) {
    return undefined;
  }
  const [key, id, value] = rawItem;
  return [value, {d: id, i: index}, key, index];
}

export function mapDataModelKeyIndexMap(map: MapDataModel): Map<string | null, number> {
  const keyIndexMap = new Map<string | null, number>();
  for (let i = mapDataSize(map) - 1; i >= 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    keyIndexMap.set(getMapKeyAtIndex(map, i)!, i);
  }
  return keyIndexMap;
}

export function getMapDataAtWithIndexCache(map: MapDataModel, key: string, indexCache: number): DataModel | undefined {
  if (map.v[indexCache][0] === key) {
    return getMapDataAtIndex(map, indexCache);
  }
  return getMapDataAt(map, key);
}

export function getMapDataAtIndex(map: MapDataModel, index: number): DataModel | undefined {
  return map.v[index][2];
}

export function getMapDataKeys(map: MapDataModel): (string | null)[] {
  return map.v.map(([key]) => key);
}

export function getMapDataIndexForId(map: MapDataModel, id: number): number | undefined {
  return map.v.findIndex((v) => v[1] === id);
}

export function getMapDataIndexForPointer(map: MapDataModel, pointer: DataPointer): number | undefined {
  const id = getMapDataIdAtIndex(map, pointer.i);
  if (id === pointer.d) {
    return pointer.i;
  }
  for (let i = 0; i < mapDataSize(map); i++) {
    if (pointer.d === getMapDataIdAtIndex(map, i)) {
      return i;
    }
  }
  return undefined;
}

export function getMapDataAtPointer(map: MapDataModel, pointer: DataPointer): DataModel | undefined {
  const index = getMapDataIndexForPointer(map, pointer);
  return index === undefined ? undefined : getMapDataAtIndex(map, index);
}

export function getMapDataAtPathComponent(
  map: MapDataModel,
  pathComponent: ForwardDataPathComponent,
): DataModel | undefined {
  const index = getMapDataIndexByPathComponent(map, pathComponent);
  return index === undefined ? undefined : getMapDataAtIndex(map, index);
}

export function getMapDataPointerAtIndex(map: MapDataModel, index: number): DataPointer | undefined {
  const id = getMapDataIdAtIndex(map, index);
  return id === undefined ? undefined : {i: index, d: id};
}

export function getMapDataIdAtIndex(map: MapDataModel, index: number): number | undefined {
  return map.v[index]?.[1];
}

export function getMapKeyAtIndex(map: MapDataModel, index: number): string | null | undefined {
  return index === undefined ? undefined : map.v[index][0];
}

export function getMapDataPointerByPathComponent(
  map: MapDataModel,
  pathComponent: ForwardDataPathComponent,
): DataPointer | undefined {
  const index = getMapDataIndexByPathComponent(map, pathComponent);
  return index === undefined ? undefined : getMapDataPointerAtIndex(map, index);
}

export function getMapDataIndexByPathComponent(
  map: MapDataModel,
  pathComponent: ForwardDataPathComponent,
): number | undefined {
  if (dataPathComponentIsMapKeyLike(pathComponent)) {
    return findMapDataIndexOfKey(map, dataPathComponentToMapKey(pathComponent));
  } else if (dataPathComponentIsPointer(pathComponent)) {
    return getMapDataIndexForPointer(map, pathComponent);
  } else {
    return undefined;
  }
}

function forceSetToMapDataForIndex(
  map: MapDataModel,
  value: DataModel,
  index: number,
  key?: string | null,
): MapDataModel {
  const v = [...map.v];
  const newKey = key === undefined ? v[index][0] : key;
  v[index] = [newKey, v[index][1], value];
  return {t: DataModelType.Map, v};
}

export function setToMapDataModel(map: MapDataModel, key: string, value: DataModel) {
  const index = findMapDataIndexOfKey(map, key);
  if (index === undefined) {
    return pushToMapData(map, value, key);
  } else {
    if (dataModelEquals(value, getMapDataAtIndex(map, index)!)) {
      return map;
    } else {
      return forceSetToMapDataForIndex(map, value, index, key);
    }
  }
}

function forceInsertToMapData(map: MapDataModel, value: DataModel, index: number, key?: string | null): MapDataModel {
  return {
    t: DataModelType.Map,
    v: [...map.v.slice(0, index), [key ?? null, generateDataModelId(), value], ...map.v.slice(index)],
  };
}

function forceAddToMapData(map: MapDataModel, value: DataModel, key: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key, generateDataModelId(), value]]};
}

function pushToMapData(map: MapDataModel, value: DataModel, key?: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key ?? null, generateDataModelId(), value]]};
}

function forceDeleteFromMapDataAt(map: MapDataModel, index: number): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v.slice(0, index), ...map.v.slice(index + 1)]};
}

function deleteFromMapDataAtPathComponent(map: MapDataModel, pathComponent: ForwardDataPathComponent): MapDataModel {
  if (dataPathComponentIsMapKeyLike(pathComponent)) {
    const index = findMapDataIndexOfKey(map, dataPathComponentToMapKey(pathComponent));
    return index === undefined ? map : forceDeleteFromMapDataAt(map, index);
  }
  if (dataPathComponentIsPointer(pathComponent)) {
    const index = getMapDataIndexForPointer(map, pathComponent);
    return index === undefined ? map : forceDeleteFromMapDataAt(map, index);
  }
  return map;
}

function setToMapDataRecursive(
  map: MapDataModel,
  path: ForwardDataPath,
  schema: DataSchemaContext | undefined,
  createNextChildData: CreateNextChildData,
  onKeyMissing?: (key: string | null | undefined, schema: DataSchemaContext | undefined) => MapDataModel | undefined,
): MapDataModel | undefined {
  const firstPathComponent = headDataPathComponent(path);
  const {key, index} = getMapKeyAndIndex(map, firstPathComponent);
  const childSchema = schema?.digByPath(firstPathComponent);
  if (index !== undefined) {
    const childData = getMapDataAtIndex(map, index)!;
    const nextChildData = createNextChildData(shiftDataPath(path), childData, childSchema);
    return nextChildData === undefined ? undefined : forceSetToMapDataForIndex(map, nextChildData, index, key);
  } else {
    return onKeyMissing?.(key, childSchema);
  }
}

function getMapKeyAndIndex(
  map: MapDataModel,
  pathComponent: ForwardDataPathComponent,
): {index?: number; key?: string | null} {
  if (dataPathComponentIsMapKey(pathComponent)) {
    return {index: findMapDataIndexOfKey(map, pathComponent), key: pathComponent};
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    const listIndex = dataPathComponentToListIndex(pathComponent);
    const index = listIndex >= mapDataSize(map) ? undefined : listIndex;
    return {index, key: undefined};
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    const key = pathComponent.v.toString();
    return {index: findMapDataIndexOfKey(map, key), key};
  } else if (dataPathComponentIsPointer(pathComponent)) {
    const index = getMapDataIndexForPointer(map, pathComponent);
    return {index, key: index === undefined ? undefined : getMapKeyAtIndex(map, index)};
  }
  throw new DataModelOperationError('Invalid path component');
}

export function mapDataSize(map: MapDataModel): number {
  return map.v.length;
}

export function mapDataModelKeys(map: MapDataModel): string[] {
  return [...new Set(mapDataModelRawValuesWithoutNullKey(map).map((i) => i[0]))];
}

export function mapDataModelToJsMap(map: MapDataModel): Map<string, DataModel> {
  return new Map(mapDataModelRawValuesWithoutNullKey(map).reverse());
}

export function mapDataModelRawValuesWithoutNullKey(map: MapDataModel): Array<[string, DataModel]> {
  return map.v.filter((i) => i[0] !== null) as any;
}

export function mapDataFirstElement(map: MapDataModel): DataModel | undefined {
  return mapDataSize(map) > 0 ? getMapDataAtIndex(map, 0) : undefined;
}

export function mapDataLastElement(map: MapDataModel): DataModel | undefined {
  return mapDataSize(map) > 0 ? getMapDataAtIndex(map, mapDataSize(map) - 1) : undefined;
}

export function mapDataModelMapWithEmptyKey<T>(
  model: MapDataModel,
  mapper: (value: DataModel, key: string, index: number) => T,
): T[] {
  const appearedKeys = new Set<string>();
  const results: T[] = [];
  model.v.forEach(([key, value], index) => {
    if (key !== null && !appearedKeys.has(key)) {
      appearedKeys.add(key);
      mapper(value, key, index);
    }
  });
  return results;
}

export function mapMapDataModel<T>(
  model: MapDataModel,
  mapper: (value: DataModel, key: string | null, index: number) => T,
): T[] {
  return model.v.map(([key, id, value], index) => mapper(value, key, index));
}

export function mapMapDataModelWithPointer<T>(
  model: MapDataModel,
  mapper: (value: DataModel, pointer: DataPointer, key: string | null, index: number) => T,
): T[] {
  return model.v.map(([key, id, value], index) => mapper(value, {i: index, d: id}, key, index));
}

export function findIndexMapDataModel(
  model: MapDataModel,
  match: (value: DataModel, pointer: DataPointer, key: string | null, index: number) => boolean,
): number | undefined {
  return model.v.findIndex(([key, id, value], index) => match(value, {i: index, d: id}, key, index));
}

export function* eachMapDataItem(map: MapDataModel): Generator<PublicMapDataItem, void> {
  for (let i = 0; i < mapDataSize(map); i++) {
    const [key, id, value] = map.v[i];
    yield [value, {i, d: id}, key, i];
  }
}

//#endregion For MapDataModel

//#region For CollectionDataModel
type KeyForCollection<Model, WithEmptyKey> = Model extends MapDataModel
  ? WithEmptyKey extends true
    ? string | null
    : string
  : Model extends ListDataModel
  ? number
  : never;
type IndexForMapFunc<Model> = Model extends ListDataModel ? number : undefined;

export function dataModelMap<T, Model extends DataModel, WithEmptyKey extends boolean = false>(
  model: Model,
  mapper: (value: DataModel, key: KeyForCollection<Model, WithEmptyKey>, index: IndexForMapFunc<Model>) => T,
  withEmptyKey?: WithEmptyKey,
): T[] {
  if (!dataModelIsMapOrList(model)) {
    return [];
  }

  if (Array.isArray(model)) {
    return model.map(mapper as any);
  } else {
    return withEmptyKey ? mapDataModelMapWithEmptyKey(model, mapper as any) : mapMapDataModel(model, mapper as any);
  }
}

export function getDataPointerByPathComponent(
  data: DataModel,
  pathComponent: ForwardDataPathComponent,
): DataPointer | undefined {
  if (dataModelIsList(data)) {
    return getListDataPointerByPathComponent(data, pathComponent);
  } else if (dataModelIsMap(data)) {
    return getMapDataPointerByPathComponent(data, pathComponent);
  } else {
    return undefined;
  }
}

//#endregion For CollectionDataModel

//#region For DataPointer
// Don't create this function. Because the index is cache, so it should not be referenced by other file.
// export function getIndexFromDataPointer(pointer: DataPointer | undefined): number | undefined {
//   return pointer?.i;
// }

export function getIdFromDataPointer(pointer: DataPointer | undefined): number;
export function getIdFromDataPointer(pointer: DataPointer | undefined): number | undefined;
export function getIdFromDataPointer(pointer: DataPointer | undefined): number | undefined {
  return pointer?.d;
}

export function dataPointerIdEquals(lhs: DataPointer | undefined, rhs: DataPointer | undefined): boolean {
  if (lhs === undefined || rhs === undefined) {
    return lhs === rhs;
  }
  return getIdFromDataPointer(lhs) === getIdFromDataPointer(rhs);
}
//#endregion For DataPointer

export function dataModelIsMapOrList(model: DataModel | undefined): model is MapDataModel | ListDataModel {
  return typeof model === 'object' && model !== null;
}

export function mapOrListDataModelIsMap(model: MapDataModel | ListDataModel): model is MapDataModel {
  return !Array.isArray(model);
}

export function mapOrListDataModelIsList(model: MapDataModel | ListDataModel): model is ListDataModel {
  return Array.isArray(model);
}

export function dataModelIsMap(model: DataModel | undefined): model is MapDataModel {
  return dataModelIsMapOrList(model) && mapOrListDataModelIsMap(model);
}

export function dataModelIsInteger(model: DataModel | undefined): model is number {
  return typeof model === 'number' && Number.isInteger(model);
}

export function dataModelIsNumber(model: DataModel | undefined): model is IntegerDataModel | FloatDataModel {
  return typeof model === 'number';
}

export function dataModelIsString(model: DataModel | undefined): model is StringDataModel {
  return typeof model === 'string';
}

export function dataModelIsBoolean(model: DataModel | undefined): model is BooleanDataModel {
  return typeof model === 'boolean';
}

export function dataModelIsNull(model: DataModel | undefined): model is NullDataModel {
  return model === null;
}

export function dataModelIsList(model: DataModel | undefined): model is ListDataModel {
  return Array.isArray(model);
}

export function stringDataModelToString(model: string): string {
  return model;
}

export function numberDataModelToNumber(model: number): number {
  return model;
}

export function booleanDataModelToBoolean(model: BooleanDataModel): boolean {
  return model;
}

export function conditionIsMatch(
  condition: ConditionConfig<MultiDataPath>,
  collectDataForPath: undefined | ((path: MultiDataPath) => DataCollectionItem[]),
): boolean {
  if ('or' in condition) {
    return condition.or.some((i) => conditionIsMatch(i, collectDataForPath));
  } else if ('and' in condition) {
    return condition.and.some((i) => conditionIsMatch(i, collectDataForPath));
  } else if ('match' in condition) {
    const targetModels = collectDataForPath?.(condition.path) || [];
    return targetModels.some(({data}) => dataModelEqualsToUnknown(data, condition.match));
  } else {
    throw new Error('Invalid condition');
  }
}

export function dataPointerForDataPath(
  model: DataModel | undefined,
  pathComponent: ForwardDataPathComponent | undefined,
): DataPointer | undefined {
  if (!model || pathComponent === undefined || !dataModelIsMapOrList(model)) {
    return undefined;
  }
  if (Array.isArray(model)) {
    if (!dataPathComponentIsListIndexLike(pathComponent)) {
      return undefined;
    }
    return getListDataPointerAt(model, dataPathComponentToListIndex(pathComponent));
  }
  const {index} = getMapKeyAndIndex(model, pathComponent);
  return index === undefined ? undefined : getMapDataPointerAtIndex(model, index);
}

export function dataPathComponentToStringDataModel(
  pathComponent: ForwardDataPathComponent,
): StringDataModel | undefined {
  if (dataPathComponentIsMapKeyLike(pathComponent)) {
    return stringToDataModel(dataPathComponentToMapKey(pathComponent));
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    return stringToDataModel(dataPathComponentToListIndex(pathComponent).toString());
  }
  // TODO pathComponentがpointerだった場合の考慮は必要?
  return undefined;
}

export function dataPathComponentToNumberDataModel(
  pathComponent: ForwardDataPathComponent,
): IntegerDataModel | undefined {
  if (dataPathComponentIsListIndexLike(pathComponent)) {
    return numberToIntegerDataModel(dataPathComponentToListIndex(pathComponent));
  }
  return undefined;
}
