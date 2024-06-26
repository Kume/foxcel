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
  EditingForwardDataPathComponent,
  ForwardDataPathComponent,
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
  MapDataModelItem,
  MapDataModelItemWithNonNullableKey,
  NullDataModel,
  PublicListDataItem,
  PublicMapDataItem,
  StringDataModel,
} from './DataModelTypes';
import {DataModelOperationError} from './errors';
import {ConditionConfig, DataModelContextWithoutData} from '..';
import {defaultDataModelForSchema} from './DataModelWithSchema';
import {compact, isReadonlyArray} from '../common/utils';

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

export function dataModelEquals(a: DataModel | undefined, b: DataModel | undefined): boolean {
  if (a === b) {
    return true;
  }
  // === で一致判定ができないのは両方がobject(Array含む)の場合のみなので、それ以外なら一致していないと判断
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
      return a.v.every((aItem, index) => dataModelEquals(aItem[listItemDataIndex], getListDataAt(b, index)!));
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
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: SetDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);

  if (!path) {
    return dataModel === undefined || dataModelEquals(dataModel, params.model) ? undefined : params.model;
  }

  if (!dataModelIsMapOrList(dataModel)) {
    dataModel = context.schemaContext.currentSchema && defaultDataModelForSchema(context.schemaContext.currentSchema);
  }

  return setToMapOrListDataRecursive(
    dataModel,
    path,
    context,
    (childData, nextPath, childContext) => setToDataModel(childData, nextPath, childContext, params),
    (map, key) => {
      const childPath = path.next();
      // ここが最下層であれば、paramsに指定されたモデルをkeyに対してセットすれば良い
      if (!childPath) {
        return unsafeAddToMapData(map, params.model, key);
      }

      const childContext = context.pushMapKey(key);
      if (childContext.schemaContext.currentSchema) {
        const newModel = setToDataModel(undefined, childPath, childContext, params);
        return newModel === undefined ? undefined : unsafeAddToMapData(map, newModel, key);
      } else {
        // スキーマがないとデフォルトのデータを生成できないのでセット不可
        return undefined;
      }
    },
  );
}

export interface SetDataRecursiveParams {
  readonly setActions?: readonly {
    /** relative path */
    readonly path: PathContainer | undefined;
    readonly params: SetDataParams;
  }[];
  readonly setKeyActions?: readonly {
    /** relative path */
    readonly path: PathContainer | undefined;
    readonly params: SetKeyDataParams;
  }[];
  readonly deleteActions?: readonly {
    /** relative path */
    readonly path: PathContainer | undefined;
    readonly params: DeleteDataParams;
  }[];
}

/**
 *
 * 元々recursiveな設計だったが、実装が複雑になりそうだったのでrecursiveではなくなった。要改名。
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function setToDataModelRecursive(
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: SetDataRecursiveParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);

  if (!dataModelIsMapOrList(dataModel)) {
    dataModel = context.schemaContext.currentSchema && defaultDataModelForSchema(context.schemaContext.currentSchema);
  }

  if (!path) {
    let model = dataModel;
    if (params.setActions) {
      for (const action of params.setActions) {
        model = setToDataModel(model, action.path, context, action.params) ?? model;
      }
    }
    if (params.setKeyActions) {
      for (const action of params.setKeyActions) {
        model = setKeyToDataModel(model, action.path, context, action.params) ?? model;
      }
    }
    if (params.deleteActions) {
      for (const action of params.deleteActions) {
        model = deleteFromDataModel(model, action.path, context, action.params) ?? model;
      }
    }
    return model === dataModel ? undefined : model;
  }

  return setToMapOrListDataRecursive(
    dataModel,
    path,
    context,
    (childData, nextPath, childContext) => setToDataModelRecursive(childData, nextPath, childContext, params),
    (map, key) => {
      const childContext = context.pushMapKey(key);
      if (childContext.schemaContext.currentSchema) {
        const newModel = setToDataModelRecursive(undefined, path.next(), childContext, params);
        return newModel === undefined ? undefined : unsafeAddToMapData(map, newModel, key);
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
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: SetKeyDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  if (!path) {
    return undefined;
  }
  if (!path.next()) {
    if (!dataModelIsMap(dataModel)) {
      return undefined;
    }
    const child = path.mapChild(dataModel);
    if (!child) {
      return undefined;
    }
    const [, , index] = child;
    const prevKey = index !== undefined ? getMapKeyAtIndex(dataModel, index) : undefined;
    return index !== undefined && prevKey !== params.key
      ? unsafeSetMapKeyForIndex(dataModel, index, params.key)
      : undefined;
  } else {
    return setToMapOrListDataRecursive(dataModel, path, context, (childData, nextPath, childContext) =>
      setKeyToDataModel(childData, nextPath, childContext, params),
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
  nextForListIndex(list: ListDataModel | undefined, index: number): PathContainer | undefined;
  nextForMapKey(map: MapDataModel | undefined, key: string): PathContainer | undefined;
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

  public static mapChildForIndex(map: DataModel | undefined, index: number): PathContainerMapChild {
    if (!dataModelIsMap(map)) {
      return undefined;
    }
    const item = getMapItemAtIndex(map, index);
    if (!item) {
      return undefined;
    }
    const [model, , key] = item;
    return [model, key, index];
  }

  public static mapItemToChild(item: PublicMapDataItem): PathContainerMapChild {
    const [model, , key, index] = item;
    return [model, key, index];
  }

  private constructor(
    private readonly path: readonly (number | string)[],
    private readonly index: number,
  ) {}

  public get isLast(): boolean {
    return this.path.length - 1 === this.index;
  }
  next(): PathContainer | undefined {
    return this.isLast ? undefined : new SimplePathContainer(this.path, this.index + 1);
  }
  nextForListIndex(list: ListDataModel | undefined, index: number): PathContainer | undefined {
    return this.path[this.index] === index ? this.next() : undefined;
  }
  nextForMapKey(map: MapDataModel | undefined, key: string): PathContainer | undefined {
    return this.path[this.index] === key ? this.next() : undefined;
  }
  listChild(list: DataModel | undefined): [model: DataModel, index: number] | undefined {
    const current = this.path[this.index];
    if (typeof current !== 'number') return undefined;
    return SimplePathContainer.listChildForIndex(list, current);
  }
  mapChild(map: DataModel | undefined): PathContainerMapChild {
    const current = this.path[this.index];
    return typeof current === 'string'
      ? SimplePathContainer.mapChildForKey(map, current)
      : SimplePathContainer.mapChildForIndex(map, current);
  }
}

interface InsertDataParams {
  readonly after?: number;
  readonly model?: DataModel;
  readonly models?: readonly DataModel[];
}

export function insertToDataModel(
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: InsertDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);

  if (!path) {
    if (!dataModelIsMapOrList(dataModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(dataModel)) {
      const index =
        params.after === undefined ? 0 : isValidMapIndex(dataModel, params.after) ? params.after + 1 : undefined;
      if (index === undefined) {
        return undefined;
      }
      if (params.model !== undefined) {
        return unsafeInsertToMapData(dataModel, params.model, index);
      } else if (params.models !== undefined) {
        return unsafeInsertValuesToMapData(dataModel, params.models, index);
      } else {
        return undefined;
      }
    } else {
      const index =
        params.after === undefined ? 0 : isValidListIndex(dataModel, params.after) ? params.after + 1 : undefined;
      if (index === undefined) {
        return undefined;
      }
      if (params.model !== undefined) {
        return unsafeInsertToListData(dataModel, params.model, index);
      } else if (params.models !== undefined) {
        return unsafeInsertValuesToListData(dataModel, params.models, index);
      } else {
        return undefined;
      }
    }
  } else {
    return setToMapOrListDataRecursive(dataModel, path, context, (childData, nextPath, childContext) =>
      insertToDataModel(childData, nextPath, childContext, params),
    );
  }
}

export interface PushDataParams {
  readonly models?: readonly {readonly value: DataModel; readonly key?: string}[];
  readonly model?: DataModel;
  readonly key?: string;
}

export function pushToDataModel(
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: PushDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  if (!path) {
    if (!dataModelIsMapOrList(dataModel)) {
      throw new DataModelOperationError(
        `Cannot push data to ${dataModel === undefined ? 'undefined' : dataModelTypeToLabel(dataModelType(dataModel))}`,
      );
    }
    if (mapOrListDataModelIsMap(dataModel)) {
      if (params.model) {
        return pushToMapData(dataModel, params.model, params.key);
      } else if (params.models) {
        return pushValuesToMapData(dataModel, params.models);
      } else {
        return undefined;
      }
    } else {
      if (params.model) {
        return pushToListData(dataModel, params.model);
      } else if (params.models) {
        return pushValuesToListData(
          dataModel,
          params.models.map(({value}) => value),
        );
      } else {
        return undefined;
      }
    }
  } else {
    return setToMapOrListDataRecursive(dataModel, path, context, (childData, nextPath, childContext) =>
      pushToDataModel(childData, nextPath, childContext, params),
    );
  }
}

interface DeleteDataParams {
  at?: number | readonly number[];
}

/**
 * @return 更新があったら更新後のデータモデルを、更新がなければundefinedを返す
 */
export function deleteFromDataModel(
  dataModel: DataModel | undefined,
  path: PathContainer | undefined,
  context: DataModelContextWithoutData,
  params: DeleteDataParams,
): DataModel | undefined {
  context.assertAutoResolveConditional(true);
  if (!path) {
    if (params.at === undefined) {
      return undefined;
    }
    if (!dataModelIsMapOrList(dataModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(dataModel)) {
      if (isReadonlyArray(params.at)) {
        return deleteFromMapDataAtIndexes(dataModel, params.at);
      } else {
        return getMapItemAtIndex(dataModel, params.at) && unsafeDeleteFromMapDataAt(dataModel, params.at);
      }
    } else {
      if (isReadonlyArray(params.at)) {
        return deleteFromListDataAtIndexes(dataModel, params.at);
      } else {
        return getListItemAt(dataModel, params.at) && unsafeDeleteFromListDataAt(dataModel, params.at);
      }
    }
  }

  if (params.at === undefined && !path.next()) {
    if (!dataModelIsMapOrList(dataModel)) {
      return undefined;
    }
    if (mapOrListDataModelIsMap(dataModel)) {
      const index = path.mapChild(dataModel)?.[2];
      return index === undefined ? undefined : unsafeDeleteFromMapDataAt(dataModel, index);
    } else {
      const index = path.listChild(dataModel)?.[1];
      return index === undefined ? undefined : unsafeDeleteFromListDataAt(dataModel, index);
    }
  }

  return setToMapOrListDataRecursive(dataModel, path, context, (childData, nextPath, childContext) =>
    deleteFromDataModel(childData, nextPath, childContext, params),
  );
}

export function getDataModelByPathContainer(
  model: DataModel | undefined,
  path: PathContainer | undefined,
): DataModel | undefined {
  if (!path) {
    return model;
  }
  if (!dataModelIsMapOrList(model)) {
    return undefined;
  }
  if (mapOrListDataModelIsMap(model)) {
    return getDataModelByPathContainer(path.mapChild(model)?.[0], path.next());
  } else {
    return getDataModelByPathContainer(path.listChild(model)?.[0], path.next());
  }
}

export function getDataModelSimple(
  model: DataModel | undefined,
  path: readonly (number | string)[],
): DataModel | undefined {
  return getDataModelByPathContainer(model, SimplePathContainer.create(path));
}

type CreateNextChildData = (
  childData: DataModel,
  nextPath: PathContainer | undefined,
  context: DataModelContextWithoutData,
) => DataModel | undefined;

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
    return getListDataIndexAtPointer(list, pathComponent);
  } else {
    return undefined;
  }
}

export function getListDataIndexAtPointer(list: ListDataModel, pointer: DataPointer): number | undefined {
  if (getListDataIdAtIndex(list, pointer.i) === pointer.d) {
    return pointer.i;
  }
  return list.v.findIndex((item) => pointer.d === item[listItemIdIndex]);
}

export function getListIndexForId(list: ListDataModel, id: number): number | undefined {
  return list.v.findIndex((item) => item[listItemIdIndex] === id);
}

export function isValidListIndex(list: ListDataModel, index: number): boolean {
  return index >= 0 && index < listDataSize(list);
}

export function listDataSize(list: ListDataModel): number {
  return list.v.length;
}

export function setToListDataAt(list: ListDataModel, value: DataModel, at: number): ListDataModel {
  const childData = getListDataAt(list, at);
  if (!childData) {
    throw new DataModelOperationError('Cannot set data to out of index range of list.');
  }
  return dataModelEquals(childData, value) ? list : unsafeSetToListData(list, value, at);
}

function unsafeSetToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  const v = [...list.v];
  v[index] = [v[index][listItemIdIndex], value];
  return {t: DataModelType.List, v, m: list.m};
}

function unsafeInsertToListData(list: ListDataModel, value: DataModel, index: number): ListDataModel {
  const v = [...list.v.slice(0, index), [list.m + 1, value] as const, ...list.v.slice(index)];
  return {t: DataModelType.List, v, m: list.m + 1};
}

function unsafeInsertValuesToListData(list: ListDataModel, values: readonly DataModel[], index: number): ListDataModel {
  const v = [
    ...list.v.slice(0, index),
    ...values.map((value, i) => [list.m + i + 1, value] as const),
    ...list.v.slice(index),
  ];
  return {t: DataModelType.List, v, m: list.m + values.length};
}

export function pushToListData(list: ListDataModel, value: DataModel): ListDataModel {
  return {t: DataModelType.List, v: [...list.v, [list.m + 1, value]], m: list.m + 1};
}

export function pushValuesToListData(list: ListDataModel, values: readonly DataModel[]): ListDataModel {
  return {
    t: DataModelType.List,
    v: [...list.v, ...values.map((value, index) => [list.m + 1 + index, value] as const)],
    m: list.m + list.v.length,
  };
}

function unsafeDeleteFromListDataAt(list: ListDataModel, index: number): ListDataModel {
  return {t: DataModelType.List, v: [...list.v.slice(0, index), ...list.v.slice(index + 1)], m: list.m};
}

function deleteFromListDataAtIndexes(list: ListDataModel, indexes: readonly number[]): ListDataModel | undefined {
  const values: (readonly [id: number, data: DataModel])[] = [];
  const indexSet = new Set(indexes);
  list.v.forEach((v, index) => {
    if (!indexSet.has(index)) {
      values.push(v);
    }
  });
  return list.v.length === values.length ? undefined : {t: DataModelType.List, v: values, m: list.m};
}

export function deleteFromListDataAtPathComponent(
  list: ListDataModel,
  pathComponent: EditingForwardDataPathComponent,
): ListDataModel {
  const index = getListDataIndexByPathComponent(list, pathComponent);
  return index === undefined ? list : unsafeDeleteFromListDataAt(list, index);
}

function setToListDataRecursive(
  list: ListDataModel,
  path: PathContainer,
  context: DataModelContextWithoutData,
  createNextChildData: CreateNextChildData,
): ListDataModel | undefined {
  const child = path.listChild(list);
  if (!child) {
    return undefined;
  }

  const [childData, childIndex] = child;
  const nextChildData = createNextChildData(childData, path.next(), context.pushListIndex(childIndex));
  return nextChildData === undefined ? undefined : unsafeSetToListData(list, nextChildData, childIndex);
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

export function isValidMapIndex(map: MapDataModel, index: number): boolean {
  return index >= 0 && index < mapDataSize(map);
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

function unsafeSetToMapDataForIndex(
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

function unsafeSetMapKeyForIndex(map: MapDataModel, index: number, key: string | null): MapDataModel {
  const v = [...map.v];
  const item = v[index];
  v[index] = [key, item[mapItemIdIndex], item[mapItemDataIndex]];
  return {t: DataModelType.Map, v, m: map.m};
}

export function setToMapDataModel(map: MapDataModel, key: string, value: DataModel): MapDataModel {
  const index = getMapDataIndexAt(map, key);
  if (index === undefined) {
    return pushToMapData(map, value, key);
  } else {
    if (dataModelEquals(value, getMapDataAtIndex(map, index)!)) {
      return map;
    } else {
      return unsafeSetToMapDataForIndex(map, value, index, key);
    }
  }
}

function unsafeInsertToMapData(map: MapDataModel, value: DataModel, index: number, key?: string | null): MapDataModel {
  return {
    t: DataModelType.Map,
    v: [...map.v.slice(0, index), [key ?? null, map.m + 1, value], ...map.v.slice(index)],
    m: map.m + 1,
  };
}

function unsafeInsertValuesToMapData(map: MapDataModel, values: readonly DataModel[], index: number): MapDataModel {
  return {
    t: DataModelType.Map,
    v: [
      ...map.v.slice(0, index),
      ...values.map((value, i) => [null, map.m + 1 + i, value] as const),
      ...map.v.slice(index),
    ],
    m: map.m + values.length,
  };
}

function unsafeAddToMapData(map: MapDataModel, value: DataModel, key: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key, map.m + 1, value]], m: map.m + 1};
}

function pushToMapData(map: MapDataModel, value: DataModel, key?: string): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v, [key ?? null, map.m + 1, value]], m: map.m + 1};
}

function pushValuesToMapData(
  map: MapDataModel,
  values: readonly {readonly key?: string; readonly value: DataModel}[],
): MapDataModel {
  return {
    t: DataModelType.Map,
    v: [...map.v, ...values.map(({value, key}, index) => [key ?? null, map.m + 1 + index, value] as const)],
    m: map.m + values.length,
  };
}

function unsafeDeleteFromMapDataAt(map: MapDataModel, index: number): MapDataModel {
  return {t: DataModelType.Map, v: [...map.v.slice(0, index), ...map.v.slice(index + 1)], m: map.m};
}

function deleteFromMapDataAtIndexes(map: MapDataModel, indexes: readonly number[]): MapDataModel | undefined {
  const indexSet = new Set(indexes);
  const values: MapDataModelItem[] = [];
  map.v.forEach((value, index) => {
    if (!indexSet.has(index)) {
      values.push(value);
    }
  });
  return mapDataSize(map) === values.length ? undefined : {t: DataModelType.Map, v: values, m: map.m};
}

function setToMapDataRecursive(
  map: MapDataModel,
  path: PathContainer,
  context: DataModelContextWithoutData,
  createNextChildData: CreateNextChildData,
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
    const nextChildData = createNextChildData(childData, path.next(), context.pushMapIndex(childIndex, childKey));
    return nextChildData === undefined
      ? undefined
      : unsafeSetToMapDataForIndex(map, nextChildData, childIndex, childKey);
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
function setToMapOrListDataRecursive(
  model: DataModel | undefined,
  path: PathContainer,
  context: DataModelContextWithoutData,
  createNextChildData: CreateNextChildData,
  onKeyMissing?: (map: MapDataModel, key: string) => MapDataModel | undefined,
): DataModel | undefined {
  if (dataModelIsMapOrList(model)) {
    if (mapOrListDataModelIsMap(model)) {
      return setToMapDataRecursive(model, path, context, createNextChildData, (key) => onKeyMissing?.(model, key));
    } else {
      return setToListDataRecursive(model, path, context, createNextChildData);
    }
  } else {
    return undefined;
  }
}

export function mapOrListDataSize(mapOrList: MapDataModel | ListDataModel): number {
  return mapOrList.v.length;
}
//#endregion For CollectionDataModel

//#region For DataPointer
// Don't create this function. Because the index is cache, so it should not be referenced by other file.
// export function getIndexFromDataPointer(pointer: DataPointer | undefined): number | undefined {
//   return pointer?.i;
// }

export function getIdFromDataPointer(pointer: DataPointer): number;
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
