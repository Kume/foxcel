import {
  dataPathComponentIsIndexOrKey,
  dataPathComponentIsListIndex,
  dataPathComponentIsListIndexLike,
  dataPathComponentIsMapKey,
  dataPathComponentIsPointer,
  dataPathFirstComponent,
  dataPathLength,
  ForwardDataPath,
  ForwardDataPathComponent,
  getListIndexFromDataPathElement,
  getListIndexFromDataPathElementOrFail,
  MultiDataPath,
  shiftDataPath,
} from './DataPath';
import {
  DataCollectionItem,
  DataModel,
  DataModelType,
  DataPointer,
  ListDataModel,
  MapDataModel,
  StringDataModel,
} from './DataModelTypes';
import {DataSchemaContext, dataSchemaIsFixedMap} from './DataSchema';
import {DataModelOperationError} from './errors';
import {ConditionConfig} from '..';

let currentId = 0;
export function generateDataModelId(): number {
  return currentId++;
}

export function dataModelTypeToLabel(type: DataModelType): string {
  return DataModelType[type];
}

export const emptyMapModel: MapDataModel = {t: DataModelType.Map, v: []};

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

function dataModelEquals(a: DataModel, b: DataModel): boolean {
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

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function setToDataModel(
  path: ForwardDataPath,
  value: DataModel,
  to: DataModel,
  schema?: DataSchemaContext,
): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    return dataModelEquals(value, to) ? undefined : value;
  }
  if (!dataModelIsMapOrList(to)) {
    throw new DataModelOperationError(`Cannot set data to ${dataModelTypeToLabel(dataModelType(to))}`);
  }
  if (dataModelIsList(to)) {
    return setToListDataItr(to, path, schema, (nextPath, childData, childSchema) =>
      setToDataModel(nextPath, value, childData, childSchema),
    );
  }
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
      if (pathLength > 1) {
        // TODO fixedMap以外にも自動セットを行えるようにする
        if (dataSchemaIsFixedMap(schema?.currentSchema)) {
          // TODO DataSchemaに設定されたデフォルトデータを利用できるなら利用する
          const newModel = setToDataModel(shiftDataPath(path), value, emptyMapModel, schema) ?? emptyMapModel;
          return forceAddToMapData(to, newModel, key);
        }
      }
      throw new DataModelOperationError('Cannot set data to empty value');
    },
  );
}

export function pushToDataModel(
  path: ForwardDataPath,
  value: DataModel,
  to: DataModel,
  schema?: DataSchemaContext,
): DataModel | undefined {
  const pathLength = dataPathLength(path);

  if (!dataModelIsMapOrList(to)) {
    throw new DataModelOperationError(`Cannot push data to ${dataModelTypeToLabel(dataModelType(to))}`);
  }
  if (dataModelIsList(to)) {
    if (pathLength === 0) {
      return pushToListData(to, value);
    } else {
      return setToListDataItr(to, path, schema, (nextPath, childData, childSchema) =>
        pushToDataModel(nextPath, value, childData, childSchema),
      );
    }
  }
  if (pathLength === 0) {
    return pushToMapData(to, value);
  } else {
    return setToMapDataRecursive(
      to,
      path,
      schema,
      (nextPath, childData, childSchema) => pushToDataModel(nextPath, value, childData, childSchema),
      () => {
        throw new DataModelOperationError('Cannot push data to empty value');
      },
    );
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
  if (Array.isArray(model)) {
    if (!dataPathComponentIsListIndexLike(pathComponent)) {
      return undefined;
    }
    const index = getListIndexFromDataPathElement(pathComponent);
    return getListDataAt(model, index);
  }
  const {index} = getMapKeyAndIndex(model, pathComponent);
  return index === undefined ? undefined : getMapDataAtIndex(model, index);
}

export function getFromDataModel(model: DataModel, path: ForwardDataPath): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    return model;
  }
  const firstPathComponent = dataPathFirstComponent(path);
  const childModel = getFromDataModelForPathComponent(model, firstPathComponent);
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

export function getListDataPointerAt(list: ListDataModel, at: number): DataPointer | undefined {
  return {i: at, d: list[at][0]};
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
  v[index] = [generateDataModelId(), value];
  return v;
}

function pushToListData(list: ListDataModel, value: DataModel): ListDataModel {
  return [...list, [generateDataModelId(), value]];
}

function setToListDataItr(
  list: ListDataModel,
  path: ForwardDataPath,
  schema: DataSchemaContext | undefined,
  createNextChildData: CreateNextChildData,
): ListDataModel | undefined {
  const index = getListIndexFromDataPathElementOrFail(dataPathFirstComponent(path));
  const childData = getListDataAt(list, index);
  const childSchema = schema && schema.getListChild();
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  const nextChildData = createNextChildData(shiftDataPath(path), childData, childSchema);
  return nextChildData === undefined ? undefined : forceSetToListData(list, nextChildData, index);
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
  return index === undefined ? undefined : map.v[index][2];
}

export function getMapDataAtIndex(map: MapDataModel, index: number): DataModel | undefined {
  return index === undefined ? undefined : map.v[index][2];
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

export function getMapDataPointerAtIndex(map: MapDataModel, index: number): DataPointer | undefined {
  const id = getMapDataIdAtIndex(map, index);
  return id === undefined ? undefined : {i: index, d: id};
}

export function getMapDataIdAtIndex(map: MapDataModel, index: number): number | undefined {
  return map.v[index][1];
}

export function getMapKeyAtIndex(map: MapDataModel, index: number): string | null | undefined {
  return index === undefined ? undefined : map.v[index][0];
}

function forceSetToMapDataForIndex(map: MapDataModel, value: DataModel, index: number, key?: string): MapDataModel {
  const v = [...map.v];
  const newKey = key === undefined ? v[index][0] : key;
  v[index] = [newKey, generateDataModelId(), value];
  return {t: DataModelType.Map, v};
}

function forceAddToMapData(map: MapDataModel, value: DataModel, key: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key, generateDataModelId(), value]]};
}

function pushToMapData(map: MapDataModel, value: DataModel): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [null, generateDataModelId(), value]]};
}

function setToMapDataRecursive(
  map: MapDataModel,
  path: ForwardDataPath,
  schema: DataSchemaContext | undefined,
  createNextChildData: CreateNextChildData,
  onKeyMissing: (key: string | undefined, schema: DataSchemaContext | undefined) => MapDataModel | undefined,
): MapDataModel | undefined {
  const firstPathComponent = dataPathFirstComponent(path);
  const {key, index} = getMapKeyAndIndex(map, firstPathComponent);
  const childSchema = schema?.digByPath(firstPathComponent);
  if (index !== undefined) {
    const childData = getMapDataAtIndex(map, index)!;
    const nextChildData = createNextChildData(shiftDataPath(path), childData, childSchema);
    return nextChildData === undefined ? undefined : forceSetToMapDataForIndex(map, nextChildData, index, key);
  } else {
    return onKeyMissing(key, childSchema);
  }
}

function getMapKeyAndIndex(map: MapDataModel, pathComponent: ForwardDataPathComponent): {index?: number; key?: string} {
  if (dataPathComponentIsMapKey(pathComponent)) {
    return {index: findMapDataIndexOfKey(map, pathComponent), key: pathComponent};
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    const index = pathComponent >= mapDataSize(map) ? undefined : pathComponent;
    return {index, key: undefined};
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    const key = pathComponent.v.toString();
    return {index: findMapDataIndexOfKey(map, key), key};
  } else if (dataPathComponentIsPointer(pathComponent)) {
    const index = getMapDataIndexForPointer(map, pathComponent);
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

export function mapDataModelMap<T>(
  model: MapDataModel,
  mapper: (value: DataModel, key: string | null, index: number) => T,
): T[] {
  return model.v.map(([key, value], index) => mapper(value, key, index));
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
    return withEmptyKey ? mapDataModelMapWithEmptyKey(model, mapper as any) : mapDataModelMap(model, mapper as any);
  }
}

//#endregion For CollectionDataModel

export function dataModelIsMapOrList(model: DataModel): model is MapDataModel | ListDataModel {
  return typeof model === 'object' && model !== null;
}

export function dataModelIsMap(model: DataModel | undefined): model is MapDataModel {
  return typeof model === 'object' && model !== null && !Array.isArray(model);
}

export function dataModelIsInteger(model: DataModel | undefined): model is number {
  return typeof model === 'number' && Number.isInteger(model);
}

export function dataModelIsString(model: DataModel): model is StringDataModel {
  return typeof model === 'string';
}

export function dataModelIsList(model: DataModel): model is ListDataModel {
  return typeof model === 'object' && model !== null && Array.isArray(model);
}

export function stringDataModelToString(model: string): string {
  return model;
}

export function numberDataModelToNumber(model: number): number {
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
    return getListDataPointerAt(model, getListIndexFromDataPathElement(pathComponent));
  }
  const {index} = getMapKeyAndIndex(model, pathComponent);
  return index === undefined ? undefined : getMapDataPointerAtIndex(model, index);
}
