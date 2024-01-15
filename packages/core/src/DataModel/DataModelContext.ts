import {DataModel, ListDataModel, MapDataModel, StringDataModel} from './DataModelTypes';
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
  getMapDataAt,
  getMapDataAtIndex,
  getMapDataIndexAt,
  getMapItemAt,
  getMapItemAtIndex,
  PathContainer,
  PathContainerMapChild,
  stringToDataModel,
} from './DataModel';
import {AnyDataPath} from './DataPath';
import {collectDataModel, getDataModelBySinglePath} from './DataModelCollector';

export interface DataModelContextListPathComponent {
  readonly type: 'list';
  readonly index: number;
}

export interface DataModelContextMapKeyPathComponent {
  readonly type: 'map_k';

  readonly key: string;
}

export interface DataModelContextMapIndexPathComponent {
  readonly type: 'map_i';

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

export type DataModelContextPathComponent =
  | DataModelContextListPathComponent
  | DataModelContextMapKeyPathComponent
  | DataModelContextMapIndexPathComponent;

export type DataModelContextPath = readonly DataModelContextPathComponent[];

export interface DataModelRoot {
  readonly model: DataModel | undefined;
  readonly schema: DataSchemaExcludeRecursive | undefined;
}

// TODO DataPathContainerをなくせたら、PathContainerの設計をisKeyを考慮したものにする
export class DataModelContextPathContainer implements PathContainer {
  public static create({path}: SerializedDataModelContext): DataModelContextPathContainer | undefined {
    return path.length === 0 ? undefined : new DataModelContextPathContainer(path, 0);
  }

  public constructor(private readonly path: DataModelContextPath, private readonly index: number) {}

  public get isLast(): boolean {
    return this.path.length - 1 === this.index;
  }

  public next(): DataModelContextPathContainer | undefined {
    return this.isLast ? undefined : new DataModelContextPathContainer(this.path, this.index + 1);
  }

  public listChild(list: ListDataModel): [model: DataModel, index: number] | undefined {
    const currentPathComponent = this.path[this.index];
    if (currentPathComponent?.type !== 'list') {
      return undefined;
    }
    const model = getListDataAt(list, currentPathComponent.index);
    return model === undefined ? undefined : [model, currentPathComponent.index];
  }

  public mapChild(map: MapDataModel): PathContainerMapChild {
    const currentPathComponent = this.path[this.index];
    switch (currentPathComponent?.type) {
      case 'list':
        return undefined;
      case 'map_k': {
        const item = getMapItemAt(map, currentPathComponent.key);
        if (!item) {
          return [undefined, currentPathComponent.key, undefined];
        }
        const [model, , , index] = item;
        return [model, currentPathComponent.key, index];
      }
      case 'map_i': {
        const item = getMapItemAtIndex(map, currentPathComponent.index);
        if (!item) {
          return currentPathComponent.key === null ? undefined : [undefined, currentPathComponent.key, undefined];
        }
        const [model, , key, index] = item;
        return [model, key, index];
      }
      default:
        return undefined;
    }
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
      return pathComponent.type === 'list' ? getListDataAt(model, pathComponent.index) : undefined;
    } else {
      switch (pathComponent.type) {
        case 'map_k':
          return pathComponent.key === undefined ? undefined : getMapDataAt(model, pathComponent.key);
        case 'map_i':
          return getMapDataAtIndex(model, pathComponent.index);
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
      case 'list':
        return stringToDataModel(`${lastPathComponent.index}`);
      case 'map_i':
        return typeof lastPathComponent.key === 'string' ? stringToDataModel(lastPathComponent.key) : undefined;
      case 'map_k':
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
        case 'map_k':
          break;
        case 'map_i':
          // スキーマはkeyを優先して利用する
          schemaContext = schemaContext.dig(pathComponent.key ?? pathComponent.index);
          break;
        case 'list':
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
    private readonly path: readonly DataModelContextPathComponent[],
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
      throw new Error(`Invalid autoResolveConditional value. expected=${value}`);
    }
  }

  public pushListIndex(index: number): DataModelContext {
    return this.push(this.schemaContext.dig(index), {type: 'list', index});
  }

  /**
   *
   * Note: pushMapIndexが利用できるならそちらを優先して使う (アクセス速度が異なるため)
   * @param mapKey
   */
  public pushMapKey(mapKey: string): DataModelContext {
    const pushed = this.push(this.schemaContext.dig(mapKey), {type: 'map_k', key: mapKey});
    return this.autoResolveConditional ? pushed.pushConditionalOrSelf() : pushed;
  }

  public pushMapIndex(index: number, key: string | null): DataModelContext {
    const pushed = this.push(this.schemaContext.dig(key), {type: 'map_i', index, key});
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
      undefined,
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
    return this.push({type: 'map_i', index, key: mapKey});
  }

  pushListIndex(index: number): DataModelContextWithoutSchema {
    return this.push({type: 'list', index});
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
