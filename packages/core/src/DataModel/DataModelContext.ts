import {DataModel, DataPointer, ListDataModel, MapDataModel, StringDataModel} from './DataModelTypes';
import {
  ConditionalDataSchema,
  DataSchemaContext,
  DataSchemaExcludeRecursive,
  dataSchemaIsConditional,
} from './DataSchema';
import {
  conditionIsMatch,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsMapOrList,
  getListDataAt,
  getListDataIndexAtPointer,
  getListItemAt,
  getMapDataAt,
  getMapDataAtIndex,
  getMapDataAtPointer,
  getMapDataIndexAt,
  getMapDataIndexForPointer,
  getMapItemAt,
  getMapItemAtIndex,
  isValidListIndex,
  isValidMapIndex,
  PathContainer,
  PathContainerMapChild,
  SimplePathContainer,
  stringToDataModel,
} from './DataModel';
import {AnyDataPath} from './DataPath';
import {getDataModelBySinglePath} from './DataModelCollector';
import {isReadonlyArray} from '../common/utils';

const enum PathComponentType {
  List,
  MapKey,
  MapIndex,
}

export interface DataModelContextListPathComponent {
  readonly type: PathComponentType.List;
  readonly index: number;
}

export interface DataModelContextMapKeyPathComponent {
  readonly type: PathComponentType.MapKey;

  readonly key: string;
}

export interface DataModelContextMapIndexPathComponent {
  readonly type: PathComponentType.MapIndex;

  /**
   * スキーマを決定する場合など、indexでは解決不可な決定を実現するためにkey情報も持たせる
   * Mapにデータを新規追加され、keyが入力されるまではnullになりうる
   */
  readonly key: string | null;
  readonly index: number;
}

type Keys = readonly (string | number)[];

export interface SerializedDataModelContext {
  readonly path: DataModelContextPath;
  readonly keys: Keys;
  readonly isKey?: boolean;
}

type DataModelContextPathComponent =
  | DataModelContextListPathComponent
  | DataModelContextMapKeyPathComponent
  | DataModelContextMapIndexPathComponent;

type DataModelContextPath = readonly DataModelContextPathComponent[];

export interface RelativeDataModelContextPath {
  readonly path: DataModelContextPath;
  readonly isKey?: boolean;
}

const emptyRelativeDataModelContextPath: RelativeDataModelContextPath = {
  path: [],
};

function serializedPathComponentEquals(a: DataModelContextPathComponent, b: DataModelContextPathComponent): boolean {
  switch (a.type) {
    case PathComponentType.List:
      return b.type === a.type && a.index === b.index;
    case PathComponentType.MapKey:
      return b.type === a.type && a.key === b.key;
    case PathComponentType.MapIndex:
      return b.type === a.type && a.index === b.index && a.key === b.key;
  }
}

function serializedPathEquals(a: DataModelContextPath, b: DataModelContextPath): boolean {
  return a.length === b.length && a.every((value, index) => serializedPathComponentEquals(value, b[index]));
}

function serializedPathPartialEquals(
  a: DataModelContextPath,
  b: DataModelContextPath,
  start: number,
  size: number,
): boolean {
  const end = start + size;
  for (let i = start; i < end; i++) {
    if (!serializedPathComponentEquals(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

function keysEqual(a: Keys, b: Keys): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function serializedDataModelContextEquals(
  a: SerializedDataModelContext,
  b: SerializedDataModelContext,
): boolean {
  return !a.isKey === !b.isKey && serializedPathEquals(a.path, b.path) && keysEqual(a.keys, b.keys);
}

export function relativeSerializedDataModelContextPath(
  context: SerializedDataModelContext,
  from: SerializedDataModelContext,
): RelativeDataModelContextPath {
  if (serializedDataModelContextEquals(context, from)) {
    return emptyRelativeDataModelContextPath;
  }
  if (from.isKey) {
    throw new Error("Cannot create a relative path when the 'from' path points to a key");
  }
  if (
    context.path.length < from.path.length ||
    !serializedPathPartialEquals(context.path, from.path, 0, from.path.length)
  ) {
    throw new Error(`Cannot create a relative path that ascends higher in the hierarchy.`);
  }
  return {
    path: context.path.slice(from.path.length),
    isKey: context.isKey,
  };
}

export interface DataModelRoot {
  readonly model: DataModel | undefined;
  readonly schema: DataSchemaExcludeRecursive | undefined;
}

/**
 * DataPointer : listのpointer(実態がありpointerが取得できる場合)
 * number : listのindex(pointerが取得できない場合)
 * Tuple : mapのpointerとkey(実態がありpointerが取得できる場合)
 * string : mapのkey(pointerが取得できない場合)
 * null : mapのkeyもpointerも不明の場合
 */
type PathContainerPathComponent = DataPointer | number | readonly [DataPointer, string | null] | string | null;

// TODO DataPathContainerをなくせたら、PathContainerの設計をisKeyを考慮したものにする
export class DataModelContextPathContainer implements PathContainer {
  public static create(
    context: SerializedDataModelContext | RelativeDataModelContextPath,
    model: DataModel | undefined,
  ): DataModelContextPathContainer | undefined {
    return DataModelContextPathContainer.createWithTargetModel(context, model)?.[0];
  }

  public static createWithTargetModel(
    {path}: SerializedDataModelContext | RelativeDataModelContextPath,
    model: DataModel | undefined,
  ): [DataModelContextPathContainer, DataModel | undefined] | undefined {
    const innerPath: PathContainerPathComponent[] = [];
    for (const pathComponent of path) {
      switch (pathComponent.type) {
        case PathComponentType.List: {
          const item = dataModelIsList(model) ? getListItemAt(model, pathComponent.index) : undefined;
          if (item) {
            const [childModel, pointer] = item;
            model = childModel;
            innerPath.push(pointer);
          } else {
            model = undefined;
            innerPath.push(pathComponent.index);
          }
          break;
        }
        case PathComponentType.MapKey: {
          const item = dataModelIsMap(model) ? getMapItemAt(model, pathComponent.key) : undefined;
          if (item) {
            const [childModel, pointer, key] = item;
            model = childModel;
            innerPath.push([pointer, key]);
          } else {
            model = undefined;
            innerPath.push(pathComponent.key);
          }
          break;
        }
        case PathComponentType.MapIndex: {
          const item = dataModelIsMap(model) ? getMapItemAtIndex(model, pathComponent.index) : undefined;
          if (item) {
            const [childModel, pointer, key] = item;
            model = childModel;
            innerPath.push([pointer, key]);
          } else {
            model = undefined;
            innerPath.push(pathComponent.key);
          }
          break;
        }
      }
    }

    return innerPath.length === 0 ? undefined : [new DataModelContextPathContainer(innerPath, 0), model];
  }

  public constructor(private readonly path: readonly PathContainerPathComponent[], private readonly index: number) {}

  public get isLast(): boolean {
    return this.path.length - 1 === this.index;
  }

  public next(): DataModelContextPathContainer | undefined {
    return this.isLast ? undefined : new DataModelContextPathContainer(this.path, this.index + 1);
  }

  public nextForMapKey(map: MapDataModel | undefined, key: string): DataModelContextPathContainer | undefined {
    const currentPathComponent = this.path[this.index];
    switch (typeof currentPathComponent) {
      case 'string':
        return currentPathComponent === key ? this.next() : undefined;
      case 'object':
        return isReadonlyArray(currentPathComponent) &&
          map !== undefined &&
          getMapDataAtPointer(map, currentPathComponent[0])
          ? this.next()
          : undefined;
      default:
        return undefined;
    }
  }

  public nextForListIndex(list: ListDataModel | undefined, index: number): DataModelContextPathContainer | undefined {
    const currentPathComponent = this.path[this.index];
    switch (typeof currentPathComponent) {
      case 'number':
        return currentPathComponent === index ? this.next() : undefined;
      case 'object':
        return !isReadonlyArray(currentPathComponent) &&
          currentPathComponent !== null &&
          list !== undefined &&
          getListDataIndexAtPointer(list, currentPathComponent)
          ? this.next()
          : undefined;
      default:
        return undefined;
    }
  }

  public listChild(list: DataModel): [model: DataModel, index: number] | undefined {
    const currentPathComponent = this.path[this.index];
    switch (typeof currentPathComponent) {
      case 'number':
        return SimplePathContainer.listChildForIndex(list, currentPathComponent);
      case 'object':
        if (!isReadonlyArray(currentPathComponent) && currentPathComponent !== null && dataModelIsList(list)) {
          const index = getListDataIndexAtPointer(list, currentPathComponent);
          return index === undefined ? undefined : SimplePathContainer.listChildForIndex(list, index);
        }
    }
    return undefined;
  }

  public mapChild(map: DataModel): PathContainerMapChild {
    const currentPathComponent = this.path[this.index];
    switch (typeof currentPathComponent) {
      case 'string':
        return SimplePathContainer.mapChildForKey(map, currentPathComponent);
      case 'object':
        if (isReadonlyArray(currentPathComponent) && dataModelIsMap(map)) {
          const index = getMapDataIndexForPointer(map, currentPathComponent[0]);
          const item = index === undefined ? undefined : getMapItemAtIndex(map, index);
          return item && SimplePathContainer.mapItemToChild(item);
        }
    }
    return undefined;
  }
}

function addKeysDepth(prev: Keys): Keys {
  const last = prev[prev.length - 1];
  switch (typeof last) {
    case 'string':
      return [...prev, 1];
    case 'undefined':
      return [1];
    case 'number':
      return [...prev.slice(0, -1), last + 1];
  }
}

function addContextKey(keys: Keys, contextKey: string | undefined): Keys {
  return contextKey === undefined ? addKeysDepth(keys) : [...keys, contextKey];
}

function popKeys(prev: Keys, popCount: number): Keys {
  if (popCount === 0) {
    return prev;
  }
  const last = prev[prev.length - 1];
  if (typeof last === 'string') {
    return popKeys(prev.slice(0, -1), popCount - 1);
  } else {
    if (popCount > last) {
      return popKeys(prev.slice(0, -1), popCount - last);
    } else if (popCount === last) {
      return prev.slice(0, -1);
    } else {
      return [...prev.slice(0, -1), last - popCount];
    }
  }
}

function getModelByPath(
  model: DataModel | undefined,
  path: readonly DataModelContextPathComponent[],
  index: number = 0,
): DataModel | undefined {
  if (index >= path.length) {
    return model;
  }

  const childModel = getModelByPathComponent(model, path[index]);
  return childModel === undefined ? undefined : getModelByPath(childModel, path, index + 1);
}

function getModelByPathComponent(
  model: DataModel | undefined,
  pathComponent: DataModelContextPathComponent,
): DataModel | undefined {
  if (dataModelIsMapOrList(model)) {
    if (dataModelIsList(model)) {
      return pathComponent.type === PathComponentType.List && isValidListIndex(model, pathComponent.index)
        ? getListDataAt(model, pathComponent.index)
        : undefined;
    } else {
      switch (pathComponent.type) {
        case PathComponentType.MapKey:
          return pathComponent.key === undefined ? undefined : getMapDataAt(model, pathComponent.key);
        case PathComponentType.MapIndex:
          return isValidMapIndex(model, pathComponent.index)
            ? getMapDataAtIndex(model, pathComponent.index)
            : undefined;
        default:
          return undefined;
      }
    }
  } else {
    return undefined;
  }
}

function getParentKeyDataModel(path: DataModelContextPath): StringDataModel | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    const lastPathComponent = path[i];
    switch (lastPathComponent.type) {
      case PathComponentType.List:
        return stringToDataModel(`${lastPathComponent.index}`);
      case PathComponentType.MapIndex:
        return typeof lastPathComponent.key === 'string' ? stringToDataModel(lastPathComponent.key) : undefined;
      case PathComponentType.MapKey:
        return lastPathComponent.key;
    }
  }
  return undefined;
}

function resolveConditionKey(
  schema: ConditionalDataSchema,
  context: DataModelContextWithoutSchema,
): string | undefined {
  const result = Object.entries(schema.items).find(([, item]) => {
    return conditionIsMatch(item.condition, (path) => getDataModelBySinglePath(path, context));
  })?.[0];
  return result;
}

function depthFromKey(keys: Keys, key: string): number {
  let depth = 0;
  for (const keyItem of [...keys].reverse()) {
    if (typeof keyItem === 'string') {
      if (keyItem === key) {
        return depth;
      } else {
        depth++;
      }
    } else {
      depth += keyItem;
    }
  }
  // このエラーが発生しないようにスキーマ構築時にバリデーションする
  return 0;
}

function pathStartReverseCount(path: AnyDataPath, contextPath: DataModelContextPath, keys: Keys): number {
  return path.isAbsolute ? contextPath.length : (path.r ?? 0) + (path.ctx ? depthFromKey(keys, path.ctx) : 0);
}

/**
 * DataModelのツリーを降下して処理するとき、そのノードに到達するまでのパスと、付随する情報を保持しておくためのクラス。
 * あくまで一つのデータツリーをその場限りで探索する目的のため、変更を跨いで管理する想定はない。
 * そのため、ListやMapのIDは保持しない。
 *
 * Note: DataSchemaContextは再帰で巻き戻ることがあるが、こちらは常に降下するのみなので、機能をまとめることはできない。
 */
export class DataModelContext {
  public static deserialize(
    serialized: SerializedDataModelContext,
    root: DataModelRoot,
    autoResolveConditional = true,
  ): DataModelContext {
    let schemaContext = DataSchemaContext.createRootContext(root.schema);
    let currentKeys: Keys = [];
    const currentPath: DataModelContextPathComponent[] = [];
    let currentModel = root.model;
    for (const pathComponent of serialized.path) {
      // conditionalのスキーマはpathで表現されていないので、ループ毎にチェックしてconditionalなら自動で降下する。
      if (dataSchemaIsConditional(schemaContext.currentSchema)) {
        const conditionKey = resolveConditionKey(
          schemaContext.currentSchema,
          DataModelContextWithoutSchema.deserialize({path: currentPath, keys: currentKeys}, root),
        );
        schemaContext = schemaContext.dig(conditionKey);
      }
      // keysを一つ進める。contextKeyはconditionalが持つことはできないのでこの位置
      currentKeys = addContextKey(currentKeys, schemaContext.contextKey());
      switch (pathComponent.type) {
        case PathComponentType.MapKey:
          break;
        case PathComponentType.MapIndex:
          // スキーマはkeyを優先して利用する
          schemaContext = schemaContext.dig(pathComponent.key ?? pathComponent.index);
          break;
        case PathComponentType.List:
          schemaContext = schemaContext.dig(pathComponent.index);
          break;
      }
      currentModel = getModelByPathComponent(currentModel, pathComponent);
      currentPath.push(pathComponent);
    }
    const modelContext = new DataModelContext(
      schemaContext,
      serialized.path,
      serialized.keys,
      currentModel,
      root,
      autoResolveConditional,
    );
    return serialized.isKey ? modelContext.pushIsParentKey() : modelContext;
  }

  public static createRoot(root: DataModelRoot, autoResolveConditional = true): DataModelContext {
    return new DataModelContext(
      DataSchemaContext.createRootContext(root.schema),
      [],
      [],
      root.model,
      root,
      autoResolveConditional,
    );
  }

  private constructor(
    public readonly schemaContext: DataSchemaContext,
    private readonly path: DataModelContextPath,
    private readonly keys: Keys,
    public readonly currentModel: DataModel | undefined,
    public readonly root: DataModelRoot,
    private readonly autoResolveConditional: boolean,
  ) {}

  public serialize(): SerializedDataModelContext {
    return {
      path: this.path,
      keys: this.keys,
      isKey: this.schemaContext.isParentKey,
    };
  }

  public depth(): number {
    return this.path.length;
  }

  public depthFromKey(key: string): number {
    let depth = 0;
    for (const keyItem of [...this.keys].reverse()) {
      if (typeof keyItem === 'string') {
        if (keyItem === key) {
          return depth;
        } else {
          depth++;
        }
      } else {
        depth += keyItem;
      }
    }
    // このエラーが発生しないようにスキーマ構築時にバリデーションする
    return 0;
  }

  private push(schemaContext: DataSchemaContext, pathComponent: DataModelContextPathComponent): DataModelContext {
    return new DataModelContext(
      schemaContext,
      [...this.path, pathComponent],
      addContextKey(this.keys, schemaContext.contextKey()),
      getModelByPathComponent(this.currentModel, pathComponent),
      this.root,
      this.autoResolveConditional,
    );
  }

  public setAutoResolveConditional(value: boolean): DataModelContext {
    return new DataModelContext(this.schemaContext, this.path, this.keys, this.currentModel, this.root, value);
  }

  public assertAutoResolveConditional(value: boolean): void {
    if (this.autoResolveConditional !== value) {
      throw new Error(`Invalid autoResolveConditional value. expected=${value ? 'true' : 'false'}`);
    }
  }

  public pushListIndex(index: number): DataModelContext {
    return this.push(this.schemaContext.dig(index), {type: PathComponentType.List, index});
  }

  /**
   *
   * Note: pushMapIndexが利用できるならそちらを優先して使う (アクセス速度が異なるため)
   * @param mapKey
   */
  public pushMapKey(mapKey: string): DataModelContext {
    const pushed = this.push(this.schemaContext.dig(mapKey), {type: PathComponentType.MapKey, key: mapKey});
    return this.autoResolveConditional ? pushed.pushConditionalOrSelf() : pushed;
  }

  public pushMapIndex(index: number, key: string | null): DataModelContext {
    const pushed = this.push(this.schemaContext.dig(key), {type: PathComponentType.MapIndex, index, key});
    return this.autoResolveConditional ? pushed.pushConditionalOrSelf() : pushed;
  }

  public pushMapIndexOrKey(mapKey: string): DataModelContext {
    const indexOrFalsy = dataModelIsMap(this.currentModel) && getMapDataIndexAt(this.currentModel, mapKey);
    const pushed = typeof indexOrFalsy === 'number' ? this.pushMapIndex(indexOrFalsy, mapKey) : this.pushMapKey(mapKey);
    return this.autoResolveConditional ? pushed.pushConditionalOrSelf() : pushed;
  }

  public pushIsParentKey(): DataModelContext {
    return new DataModelContext(
      this.schemaContext.dig({t: 'key'}),
      this.path,
      this.keys,
      this.parentKeyDataModel,
      this.root,
      this.autoResolveConditional,
    );
  }

  public pushConditionalOrSelf(): DataModelContext {
    return this.pushConditionalOrSelfWithKey()[0];
  }

  public pushConditionalOrSelfWithKey(): [DataModelContext, string | undefined] {
    const currentSchema = this.schemaContext.currentSchema;
    if (dataSchemaIsConditional(currentSchema)) {
      const key = resolveConditionKey(currentSchema, this.toWithoutSchema());
      return [
        new DataModelContext(
          this.schemaContext.dig(key),
          this.path,
          this.keys,
          this.currentModel,
          this.root,
          this.autoResolveConditional,
        ),
        key,
      ];
    }
    return [this, undefined];
  }

  public pop(popCount = 1): DataModelContext {
    const poppedPath = this.path.slice(0, -popCount);
    return new DataModelContext(
      this.schemaContext.back(popCount),
      poppedPath,
      popKeys(this.keys, popCount),
      getModelByPath(this.root.model, poppedPath),
      this.root,
      this.autoResolveConditional,
    );
  }

  public popToDataPathStart(path: AnyDataPath): DataModelContext {
    return this.pop(pathStartReverseCount(path, this.path, this.keys));
  }

  public toWithoutSchema(): DataModelContextWithoutSchema {
    return DataModelContextWithoutSchema.deserialize(this.serialize(), this.root);
  }

  public get parentKeyDataModel(): StringDataModel | undefined {
    return getParentKeyDataModel(this.path);
  }

  public getModelFromRoot(rootModel: DataModel | undefined): DataModel | undefined {
    return getModelByPath(rootModel, this.path);
  }
}

export type DataModelContextWithoutData = Pick<DataModelContext, 'assertAutoResolveConditional' | 'schemaContext'> & {
  pushMapIndex(index: number, key: string | null): DataModelContext;
  pushMapIndexOrKey(mapKey: string): DataModelContextWithoutData;
  pushMapKey(mapKey: string): DataModelContextWithoutData;
  pushListIndex(index: number): DataModelContextWithoutData;
};

export class DataModelContextWithoutSchema {
  public static deserialize(
    serialized: SerializedDataModelContext,
    root: DataModelRoot,
  ): DataModelContextWithoutSchema {
    return new DataModelContextWithoutSchema(
      serialized.path,
      getModelByPath(root.model, serialized.path),
      serialized.keys,
      root,
      serialized.isKey,
    );
  }

  /**
   *
   * @param path
   * @param currentModel
   * @param keys DataModelContextと異なり、push時にkey情報が取得できないため、最初に作成した時点のkey情報を固定で持つ
   *             DataPathの仕様上、この情報を利用するのは開始地点より上のものだけのはずなので、これで大丈夫なはず。
   * @param root
   * @param isKey
   */
  public constructor(
    private readonly path: DataModelContextPath,
    public readonly currentModel: DataModel | undefined,
    public readonly keys: Keys,
    public readonly root: DataModelRoot,
    public readonly isKey?: boolean,
  ) {}

  private push(pathComponent: DataModelContextPathComponent): DataModelContextWithoutSchema {
    return new DataModelContextWithoutSchema(
      [...this.path, pathComponent],
      getModelByPathComponent(this.currentModel, pathComponent),
      this.keys,
      this.root,
      false,
    );
  }

  get parentKeyDataModel(): StringDataModel | undefined {
    return getParentKeyDataModel(this.path);
  }

  pushMapIndex(index: number, mapKey: string | null): DataModelContextWithoutSchema {
    return this.push({type: PathComponentType.MapIndex, index, key: mapKey});
  }

  pushListIndex(index: number): DataModelContextWithoutSchema {
    return this.push({type: PathComponentType.List, index});
  }

  pushIsParentKey(): DataModelContextWithoutSchema {
    return new DataModelContextWithoutSchema(this.path, this.parentKeyDataModel, this.keys, this.root, true);
  }

  public pop(popCount = 1): DataModelContextWithoutSchema {
    if (popCount === 0) {
      return this;
    }
    const popPathCount = this.isKey ? popCount - 1 : popCount;
    const poppedPath = popPathCount ? this.path.slice(0, -popPathCount) : this.path;
    return new DataModelContextWithoutSchema(
      poppedPath,
      getModelByPath(this.root.model, poppedPath),
      this.keys,
      this.root,
      false,
    );
  }

  public popToDataPathStart(path: AnyDataPath): DataModelContextWithoutSchema {
    return this.pop(pathStartReverseCount(path, this.path, this.keys));
  }
}
