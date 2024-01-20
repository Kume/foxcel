import {
  AnyDataPathComponent,
  DataPath,
  dataPathComponentIsIndexOrKey,
  dataPathComponentIsListIndex,
  dataPathComponentIsListIndexLike,
  dataPathComponentIsMapKey,
  dataPathComponentIsMapKeyLike,
  dataPathComponentIsPointer,
  dataPathComponentToListIndex,
  dataPathComponentToMapKey,
  dataPathLength,
  EditingForwardDataPath,
  EditingForwardDataPathComponent,
  ForwardDataPath,
  ForwardDataPathComponent,
  headDataPathComponent,
  shiftDataPath,
} from './DataPath';
import {
  BooleanDataModel,
  DataModel,
  DataModelType,
  DataPointer,
  FloatDataModel,
  IntegerDataModel,
  ListDataModel,
  MapDataModel,
  MapDataModelItemWithNonNullableKey,
  NullDataModel,
  PublicListDataItem,
  PublicMapDataItem,
  StringDataModel,
} from './DataModelTypes';
import {DataSchemaContext} from './DataSchema';
import {DataModelOperationError} from './errors';
import {ConditionConfig} from '..';
import {defaultDataModelForSchema} from './DataModelWithSchema';
import {compact} from '../common/utils';
import {DataModelContext} from './DataModelContext';

export function dataModelTypeToLabel(type: DataModelType): string {
  return DataModelType[type];
}

export const emptyMapModel: MapDataModel = {t: DataModelType.Map, m: 0, v: []};
export const emptyListModel: ListDataModel = {t: DataModelType.List, m: 0, v: []};
export const nullDataModel = null;
export const trueDataModel: BooleanDataModel = true;
export const falseDataModel: BooleanDataModel = false;

const listItemIdIndex = 0;
const listItemDataIndex = 1;
const mapItemKeyIndex = 0;
const mapItemIdIndex = 1;
const mapItemDataIndex = 2;

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
        return {
          t: DataModelType.List,
          m: value.length - 1,
          v: value.map((v, i) => [i, unknownToDataModel(v)]),
        };
      } else {
        const keys = Object.keys(value).filter((k) => (value as any)[k] !== undefined);
        return {
          t: DataModelType.Map,
          m: keys.length - 1,
          v: keys.map((k, i) => [k, i, unknownToDataModel((value as any)[k])]),
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
  if (a.v.length !== b.v.length) {
    return false;
  }
  switch (a.t) {
    case DataModelType.List:
      if (b.t !== a.t) {
        return false;
      }
      // switch文に入る前に長さが同じであることを確認済みのため、getListDataAt(b, index)は必ずundefinedにならない
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return a.v.every(([, aValue], index) => dataModelEquals(aValue, getListDataAt(b, index)!));
    case DataModelType.Map:
      if (b.t !== a.t) {
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
  if (mapOrListDataModelIsList(model)) {
    if (!Array.isArray(value)) {
      return false;
    }
    if (listDataSize(model) !== value.length) {
      return false;
    }
    return model.v.every(([, modelChild], index) => dataModelEqualsToUnknown(modelChild, value[index]));
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
  if (dataModelIsList(model)) {
    return model.v.map(([, v]) => dataModelToJson(v));
  }
  const map: {[key: string]: any} = {};
  model.v.forEach(([key, , value]) => {
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

export interface SetDataParams {
  readonly model: DataModel;
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function setToDataModel(
  path: PathContainer | undefined,
  context: DataModelContext,
  params: SetDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  let currentModel = context.currentModel;

  if (!path) {
    return currentModel === undefined || dataModelEquals(currentModel, params.model) ? undefined : params.model;
  }

  if (!dataModelIsMapOrList(currentModel)) {
    currentModel =
      context.schemaContext.currentSchema && defaultDataModelForSchema(context.schemaContext.currentSchema);
  }

  return setToMapOrListDataRecursive2(
    currentModel,
    path,
    context,
    (nextPath, childContext) => setToDataModel(nextPath, childContext, params),
    (map, key) => {
      const childPath = path.next();
      // ここが最下層であれば、paramsに指定されたモデルをkeyに対してセットすれば良い
      if (!childPath) {
        return forceAddToMapData(map, params.model, key);
      }

      const childContext = context.pushMapKey(key);
      if (childContext.schemaContext.currentSchema) {
        const newModel = setToDataModel(childPath, childContext, params);
        return newModel === undefined ? undefined : forceAddToMapData(map, newModel, key);
      } else {
        // スキーマがないとデフォルトのデータを生成できないのでセット不可
        return undefined;
      }
    },
  );
}

interface SetKeyDataParams {
  readonly key: string | null;
}

export function setKeyToDataModel(
  path: PathContainer | undefined,
  context: DataModelContext,
  params: SetKeyDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  const currentModel = context.currentModel;
  if (!path) {
    return undefined;
  }
  if (!path.next()) {
    if (!dataModelIsMap(currentModel)) {
      return undefined;
    }
    const child = path.mapChild(currentModel);
    if (!child) {
      return undefined;
    }
    const [, , index] = child;
    const prevKey = index !== undefined ? getMapKeyAtIndex(currentModel, index) : undefined;
    return index !== undefined && prevKey !== params.key
      ? forceSetMapKeyForIndex(currentModel, index, params.key)
      : undefined;
  } else {
    return setToMapOrListDataRecursive2(currentModel, path, context, (nextPath, childContext) =>
      setKeyToDataModel(nextPath, childContext, params),
    );
  }
}

export type PathContainerMapChild =
  // データが存在する場合
  | [model: DataModel, key: string | null, index: number]
  // データは存在しないが、キーは分かる場合
  | [model: undefined, key: string, index: undefined]
  | undefined;

export interface PathContainer {
  next(): PathContainer | undefined;
  nextForListIndex(index: number): PathContainer | undefined;
  nextForMapKey(map: MapDataModel, key: string): PathContainer | undefined;
  listChild(list: DataModel | undefined): [model: DataModel, index: number] | undefined;
  mapChild(map: DataModel | undefined): PathContainerMapChild;
}

export class SimplePathContainer implements PathContainer {
  public static create(path: readonly (number | string)[]): SimplePathContainer | undefined {
    return path.length === 0 ? undefined : new SimplePathContainer(path, 0);
  }
  public static listChildForIndex(
    list: DataModel | undefined,
    index: number,
  ): [model: DataModel, index: number] | undefined {
    if (!dataModelIsList(list)) return undefined;
    const childModel = getListDataAt(list, index);
    return childModel === undefined ? undefined : [childModel, index];
  }

  public static mapChildForKey(map: DataModel | undefined, key: string): PathContainerMapChild {
    if (!dataModelIsMap(map)) {
      return [undefined, key, undefined];
    }
    const item = getMapItemAt(map, key);
    if (!item) {
      return [undefined, key, undefined];
    }
    const [model, , , index] = item;
    return [model, key, index];
  }

  public static mapItemToChild(item: PublicMapDataItem): PathContainerMapChild {
    const [model, , key, index] = item;
    return [model, key, index];
  }

  private constructor(private readonly path: readonly (number | string)[], private readonly index: number) {}

  public get isLast(): boolean {
    return this.path.length - 1 === this.index;
  }
  next(): PathContainer | undefined {
    return this.isLast ? undefined : new SimplePathContainer(this.path, this.index + 1);
  }
  nextForListIndex(index: number): PathContainer | undefined {
    return this.path[this.index] === index ? this.next() : undefined;
  }
  nextForMapKey(map: MapDataModel, key: string): PathContainer | undefined {
    return this.path[this.index] === key ? this.next() : undefined;
  }
  listChild(list: DataModel | undefined): [model: DataModel, index: number] | undefined {
    const current = this.path[this.index];
    if (typeof current !== 'number') return undefined;
    return SimplePathContainer.listChildForIndex(list, current);
  }
  mapChild(map: DataModel | undefined): PathContainerMapChild {
    const current = this.path[this.index];
    return typeof current !== 'string' ? undefined : SimplePathContainer.mapChildForKey(map, current);
  }
}

interface InsertDataParams {
  readonly after?: DataPointer;
  readonly model: DataModel;
}

export function insertToDataModel(
  path: PathContainer | undefined,
  context: DataModelContext,
  params: InsertDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  const currentModel = context.currentModel;

  if (!path) {
    if (!dataModelIsMapOrList(currentModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(currentModel)) {
      if (params.after === undefined) {
        return forceInsertToMapData(currentModel, params.model, 0, null);
      }
      const index = getMapDataIndexForPointer(currentModel, params.after);
      if (index === undefined) {
        return undefined;
      }
      return forceInsertToMapData(currentModel, params.model, index + 1, null);
    } else {
      if (params.after === undefined) {
        return forceInsertToListData(currentModel, params.model, 0);
      }
      const index = getListDataIndexForPointer(currentModel, params.after);
      if (index === undefined) {
        return undefined;
      }
      return forceInsertToListData(currentModel, params.model, index + 1);
    }
  } else {
    return setToMapOrListDataRecursive2(currentModel, path, context, (nextPath, childContext) =>
      insertToDataModel(nextPath, childContext, params),
    );
  }
}

export interface PushDataParams {
  readonly model: DataModel;
  readonly key?: string;
}

export function pushToDataModel(
  path: PathContainer | undefined,
  context: DataModelContext,
  params: PushDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  const currentModel = context.currentModel;
  if (!path) {
    if (!dataModelIsMapOrList(currentModel)) {
      throw new DataModelOperationError(
        `Cannot push data to ${
          currentModel === undefined ? 'undefined' : dataModelTypeToLabel(dataModelType(currentModel))
        }`,
      );
    }
    if (mapOrListDataModelIsMap(currentModel)) {
      return pushToMapData(currentModel, params.model, params.key);
    } else {
      return pushToListData(currentModel, params.model);
    }
  } else {
    return setToMapOrListDataRecursive2(currentModel, path, context, (nextPath, childContext) =>
      pushToDataModel(nextPath, childContext, params),
    );
  }
}

interface DeleteDataParams {
  at: DataPointer | undefined;
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function deleteFromDataModel(
  path: PathContainer | undefined,
  context: DataModelContext,
  params: DeleteDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  const currentModel = context.currentModel;
  if (!path) {
    if (params.at === undefined) {
      return undefined;
    }
    if (!dataModelIsMapOrList(currentModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(currentModel)) {
      const index = getMapDataIndexForPointer(currentModel, params.at);
      return index === undefined ? undefined : forceDeleteFromMapDataAt(currentModel, index);
    } else {
      const index = getListDataIndexForPointer(currentModel, params.at);
      return index === undefined ? undefined : forceDeleteFromListDataAt(currentModel, index);
    }
  }

  if (params.at === undefined && !path.next()) {
    if (!dataModelIsMapOrList(currentModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(currentModel)) {
      const index = path.mapChild(currentModel)?.[2];
      return index === undefined ? undefined : forceDeleteFromMapDataAt(currentModel, index);
    } else {
      const index = path.listChild(currentModel)?.[1];
      return index === undefined ? undefined : forceDeleteFromListDataAt(currentModel, index);
    }
  }

  return setToMapOrListDataRecursive2(currentModel, path, context, (nextPath, childContext) =>
    deleteFromDataModel(nextPath, childContext, params),
  );
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
  nextPath: EditingForwardDataPath,
  childData: DataModel,
  childSchema: DataSchemaContext,
) => DataModel | undefined;

type CreateNextChildData2 = (nextPath: PathContainer | undefined, context: DataModelContext) => DataModel | undefined;

//#region For ListDataModel
export function getListDataAt(list: ListDataModel, at: number): DataModel | undefined {
  return list.v[at]?.[listItemDataIndex];
}

export function getListItemAt(list: ListDataModel, at: number): PublicListDataItem | undefined {
  if (list.v[at] === undefined) {
    return undefined;
  }
  const [id, value] = list.v[at];
  return [value, {i: at, d: id}, at];
}

export function getListDataPointerAt(list: ListDataModel, index: number): DataPointer | undefined {
  const id = getListDataIdAtIndex(list, index);
  return id === undefined ? undefined : {i: index, d: id};
}

export function getListDataIdAtIndex(list: ListDataModel, index: number): number | undefined {
  return list.v[index]?.[listItemIdIndex];
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
  pathComponent: AnyDataPathComponent,
): number | undefined {
  if (dataPathComponentIsListIndexLike(pathComponent)) {
    const index = dataPathComponentToListIndex(pathComponent);
    return index < 0 || index >= listDataSize(list) ? undefined : index;
  } else if (dataPathComponentIsPointer(pathComponent)) {
    return getListDataIndexForPointer(list, pathComponent);
  } else {
    return undefined;
  }
}

export function getListDataIndexForPointer(list: ListDataModel, pointer: DataPointer): number | undefined {
  if (getListDataIdAtIndex(list, pointer.i) === pointer.d) {
    return pointer.i;
  }
  return list.v.findIndex((item) => pointer.d === item[listItemIdIndex]);
}

export function getListDataIndexForId(list: ListDataModel, id: number): number | undefined {
  return list.v.findIndex((item) => item[listItemIdIndex] === id);
}

export function listDataSize(list: ListDataModel): number {
  return list.v.length;
}

export function setToListDataAt(list: ListDataModel, value: DataModel, at: number): ListDataModel {
  const childData = getListDataAt(list, at);
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  return dataModelEquals(childData, value) ? list : forceSetToListData(list, value, at);
}

function forceSetToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  const v = [...list.v];
  v[index] = [v[index][listItemIdIndex], value];
  return {t: DataModelType.List, v, m: list.m};
}

function forceInsertToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  const v = [...list.v.slice(0, index), [list.m + 1, value] as const, ...list.v.slice(index)];
  return {t: DataModelType.List, v, m: list.m + 1};
}

export function pushToListData(list: ListDataModel, value: DataModel): ListDataModel {
  return {t: DataModelType.List, v: [...list.v, [list.m + 1, value]], m: list.m + 1};
}

function forceDeleteFromListDataAt(list: ListDataModel, index: number): ListDataModel {
  return {t: DataModelType.List, v: [...list.v.slice(0, index), ...list.v.slice(index + 1)], m: list.m};
}

export function deleteFromListDataAtPathComponent(
  list: ListDataModel,
  pathComponent: EditingForwardDataPathComponent,
): ListDataModel {
  const index = getListDataIndexByPathComponent(list, pathComponent);
  return index === undefined ? list : forceDeleteFromListDataAt(list, index);
}

function setToListDataRecursive2(
  list: ListDataModel,
  path: PathContainer,
  context: DataModelContext,
  createNextChildData: CreateNextChildData2,
): ListDataModel | undefined {
  const child = path.listChild(list);
  if (!child) {
    return undefined;
  }

  const [, childIndex] = child;
  const nextChildData = createNextChildData(path.next(), context.pushListIndex(childIndex));
  return nextChildData === undefined ? undefined : forceSetToListData(list, nextChildData, childIndex);
}

function setToListDataRecursive(
  list: ListDataModel,
  path: EditingForwardDataPath,
  schema: DataSchemaContext,
  createNextChildData: CreateNextChildData,
): ListDataModel | undefined {
  const index = getListDataIndexByPathComponent(list, headDataPathComponent(path));
  if (index === undefined) {
    throw new DataModelOperationError(
      `Invalid data path type for set to list data [${JSON.stringify(headDataPathComponent(path))}]`,
    );
  }
  const childData = getListDataAt(list, index);
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  const childSchema = schema && schema.getListChild();
  const nextChildData = createNextChildData(shiftDataPath(path), childData, childSchema);
  return nextChildData === undefined ? undefined : forceSetToListData(list, nextChildData, index);
}

export function mapListDataModel<T>(
  list: ListDataModel,
  mapper: (item: DataModel, index: number, id: number) => T,
): T[] {
  return list.v.map(([id, item], index) => mapper(item, index, id));
}

export function findListDataModel(
  list: ListDataModel,
  match: (item: DataModel, pointer: DataPointer, index: number) => boolean,
): number | undefined {
  return list.v.findIndex(([id, item], index) => match(item, {i: index, d: id}, index));
}

export function* eachListDataItem(list: ListDataModel): Generator<PublicListDataItem, void> {
  for (let i = 0; i < listDataSize(list); i++) {
    const [id, value] = list.v[i];
    yield [value, {i, d: id}, i];
  }
}

export function mapListDataModelWithPointer<T>(
  list: ListDataModel,
  mapper: (item: DataModel, pointer: DataPointer, index: number) => T,
): T[] {
  return list.v.map(([id, item], index) => mapper(item, {i: index, d: id}, index));
}

//#endregion For ListDataModel

//#region For MapDataModel
export function getMapDataIndexAt(map: MapDataModel, key: string): number | undefined {
  for (let i = 0; i < mapDataSize(map); i++) {
    if (getMapKeyAtIndex(map, i) === key) {
      return i;
    }
  }
  return undefined;
}

export function getMapDataAt(map: MapDataModel, key: string): DataModel | undefined {
  const index = getMapDataIndexAt(map, key);
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

export function getMapItemAt(map: MapDataModel, key: string): PublicMapDataItem | undefined {
  const index = getMapDataIndexAt(map, key);
  return index === undefined ? undefined : getMapItemAtIndex(map, index);
}

export function mapDataModelKeyIndexMap(map: MapDataModel): Map<string | null, number> {
  const keyIndexMap = new Map<string | null, number>();
  for (let i = mapDataSize(map) - 1; i >= 0; i--) {
    keyIndexMap.set(getMapKeyAtIndex(map, i), i);
  }
  return keyIndexMap;
}

export function getMapDataAtIndex(map: MapDataModel, index: number): DataModel | undefined {
  return map.v[index][mapItemDataIndex];
}

export function getMapDataKeys(map: MapDataModel): (string | null)[] {
  return map.v.map(([key]) => key);
}

export function getMapDataIndexForId(map: MapDataModel, id: number): number | undefined {
  return map.v.findIndex((v) => v[mapItemIdIndex] === id);
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

export function getMapDataPointerAt(map: MapDataModel, key: string): DataPointer | undefined {
  const index = getMapDataIndexAt(map, key);
  return index === undefined ? undefined : getMapDataPointerAtIndex(map, index);
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
  return map.v[index]?.[mapItemIdIndex];
}

export function getMapKeyAtIndex(map: MapDataModel, index: number): string | null {
  return map.v[index][mapItemKeyIndex];
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
  pathComponent: EditingForwardDataPathComponent,
): number | undefined {
  if (dataPathComponentIsMapKeyLike(pathComponent)) {
    return getMapDataIndexAt(map, dataPathComponentToMapKey(pathComponent));
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
  const newKey = key === undefined ? v[index][mapItemKeyIndex] : key;
  v[index] = [newKey, v[index][mapItemIdIndex], value];
  return {t: DataModelType.Map, v, m: map.m};
}

function forceSetMapKeyForIndex(map: MapDataModel, index: number, key: string | null): MapDataModel {
  const v = [...map.v];
  const item = v[index];
  v[index] = [key, item[mapItemIdIndex], item[mapItemDataIndex]];
  return {t: DataModelType.Map, v, m: map.m};
}

export function setToMapDataModel(map: MapDataModel, key: string, value: DataModel) {
  const index = getMapDataIndexAt(map, key);
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
    v: [...map.v.slice(0, index), [key ?? null, map.m + 1, value], ...map.v.slice(index)],
    m: map.m + 1,
  };
}

function forceAddToMapData(map: MapDataModel, value: DataModel, key: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key, map.m + 1, value]], m: map.m + 1};
}

function pushToMapData(map: MapDataModel, value: DataModel, key?: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key ?? null, map.m + 1, value]], m: map.m + 1};
}

function forceDeleteFromMapDataAt(map: MapDataModel, index: number): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v.slice(0, index), ...map.v.slice(index + 1)], m: map.m};
}

function deleteFromMapDataAtPathComponent(
  map: MapDataModel,
  pathComponent: EditingForwardDataPathComponent,
): MapDataModel {
  if (dataPathComponentIsMapKeyLike(pathComponent)) {
    const index = getMapDataIndexAt(map, dataPathComponentToMapKey(pathComponent));
    return index === undefined ? map : forceDeleteFromMapDataAt(map, index);
  }
  if (dataPathComponentIsPointer(pathComponent)) {
    const index = getMapDataIndexForPointer(map, pathComponent);
    return index === undefined ? map : forceDeleteFromMapDataAt(map, index);
  }
  return map;
}

function setToMapDataRecursive2(
  map: MapDataModel,
  path: PathContainer,
  context: DataModelContext,
  createNextChildData: CreateNextChildData2,
  onKeyMissing?: (key: string) => MapDataModel | undefined,
): MapDataModel | undefined {
  const child = path.mapChild(map);
  if (!child) {
    return undefined;
  }
  const [childData, childKey, childIndex] = child;
  if (childData === undefined) {
    return onKeyMissing?.(childKey);
  } else {
    const nextChildData = createNextChildData(path.next(), context.pushMapIndex(childIndex, childKey));
    return nextChildData === undefined
      ? undefined
      : forceSetToMapDataForIndex(map, nextChildData, childIndex, childKey);
  }
}

function setToMapDataRecursive(
  map: MapDataModel,
  path: EditingForwardDataPath,
  schema: DataSchemaContext,
  createNextChildData: CreateNextChildData,
  onKeyMissing?: (key: string | null | undefined, schema: DataSchemaContext) => MapDataModel | undefined,
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
  pathComponent: EditingForwardDataPathComponent,
): {index?: number; key?: string | null} {
  if (dataPathComponentIsMapKey(pathComponent)) {
    return {index: getMapDataIndexAt(map, pathComponent), key: pathComponent};
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    const listIndex = dataPathComponentToListIndex(pathComponent);
    const index = listIndex >= mapDataSize(map) ? undefined : listIndex;
    return {index, key: undefined};
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    const key = pathComponent.v.toString();
    return {index: getMapDataIndexAt(map, key), key};
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
  return compact([...new Set(mapDataModelRawValuesWithoutNullKey(map).map((i) => i[mapItemKeyIndex]))]);
}

export function mapDataModelToJsMap(map: MapDataModel): Map<string, DataModel> {
  return new Map(
    mapDataModelRawValuesWithoutNullKey(map)
      .reverse()
      .map((entry) => [entry[mapItemKeyIndex], entry[mapItemDataIndex]] as const),
  );
}

export function mapDataModelRawValuesWithoutNullKey(map: MapDataModel): MapDataModelItemWithNonNullableKey[] {
  return map.v.filter((i) => i[mapItemKeyIndex] !== null) as MapDataModelItemWithNonNullableKey[];
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

// TODO mapMapDataModelと共通化
export function* eachMapDataItem(map: MapDataModel): Generator<PublicMapDataItem, void> {
  for (let i = 0; i < mapDataSize(map); i++) {
    const [key, id, value] = map.v[i];
    yield [value, {i, d: id}, key, i];
  }
}

//#endregion For MapDataModel

//#region For CollectionDataModel
function setToMapOrListDataRecursive2(
  model: DataModel | undefined,
  path: PathContainer,
  context: DataModelContext,
  createNextChildData: CreateNextChildData2,
  onKeyMissing?: (map: MapDataModel, key: string) => MapDataModel | undefined,
): DataModel | undefined {
  if (dataModelIsMapOrList(model)) {
    if (mapOrListDataModelIsMap(model)) {
      return setToMapDataRecursive2(model, path, context, createNextChildData, (key) => onKeyMissing?.(model, key));
    } else {
      return setToListDataRecursive2(model, path, context, createNextChildData);
    }
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
  return model.t === DataModelType.Map;
}

export function mapOrListDataModelIsList(model: MapDataModel | ListDataModel): model is ListDataModel {
  return model.t === DataModelType.List;
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
  return dataModelIsMapOrList(model) && mapOrListDataModelIsList(model);
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
  condition: ConditionConfig<DataPath>,
  getDataForPath: undefined | ((path: DataPath) => DataModel | undefined),
): boolean {
  if ('or' in condition) {
    return condition.or.some((i) => conditionIsMatch(i, getDataForPath));
  } else if ('and' in condition) {
    return condition.and.every((i) => conditionIsMatch(i, getDataForPath));
  } else if ('match' in condition) {
    const operandData = getDataForPath?.(condition.path);
    return operandData !== undefined && dataModelEqualsToUnknown(operandData, condition.match);
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
  if (mapOrListDataModelIsList(model)) {
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
