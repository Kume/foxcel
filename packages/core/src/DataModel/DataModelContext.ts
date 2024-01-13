import {DataModel, ListDataModel, MapDataModel, StringDataModel} from './DataModelTypes';
import {DataSchemaContext, DataSchemaExcludeRecursive} from './DataSchema';
import {
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

export type DataModelContextPath = readonly DataModelContextPathComponent[];

// TODO DataPathContainerをなくせたら、PathContainerの設計をisKeyを考慮したものにする
export class DataModelContextPathContainer implements PathContainer {
  public static create({path, isKey}: SerializedDataModelContext): DataModelContextPathContainer | undefined {
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
    if (currentPathComponent.type !== 'list') {
      return undefined;
    }
    const model = getListDataAt(list, currentPathComponent.index);
    return model === undefined ? undefined : [model, currentPathComponent.index];
  }

  public mapChild(map: MapDataModel): PathContainerMapChild {
    const currentPathComponent = this.path[this.index];
    switch (currentPathComponent.type) {
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
    }
  }
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

export interface DataModelRoot {
  readonly model: DataModel | undefined;
  readonly schema: DataSchemaExcludeRecursive | undefined;
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

/**
 * DataModelのツリーを降下して処理するとき、そのノードに到達するまでのパスと、付随する情報を保持しておくためのクラス。
 * あくまで一つのデータツリーをその場限りで探索する目的のため、変更を跨いで管理する想定はない。
 * そのため、ListやMapのIDは保持しない。
 *
 * Note: DataSchemaContextは再帰で巻き戻ることがあるが、こちらは常に降下するのみなので、機能をまとめることはできない。
 */
export class DataModelContext {
  public static deserialize(serialized: SerializedDataModelContext, root: DataModelRoot): DataModelContext {
    let schemaContext = DataSchemaContext.createRootContext(root.schema);
    for (const pathComponent of serialized.path) {
      switch (pathComponent.type) {
        case 'map_k':
          schemaContext = schemaContext.dig(pathComponent.key);
          break;
        case 'map_i':
          // スキーマはkeyを優先して利用する
          schemaContext = schemaContext.dig(pathComponent.key ?? pathComponent.index);
          break;
        case 'list':
          schemaContext = schemaContext.dig(pathComponent.index);
          break;
      }
    }
    const modelContext = new DataModelContext(
      schemaContext,
      serialized.path,
      serialized.keys,
      getModelByPath(root.model, serialized.path),
      root,
    );
    return serialized.isKey ? modelContext.pushIsParentKey() : modelContext;
  }

  public static createRoot(root: DataModelRoot): DataModelContext {
    return new DataModelContext(DataSchemaContext.createRootContext(root.schema), [], [], root.model, root);
  }

  private constructor(
    public readonly schemaContext: DataSchemaContext,
    private readonly path: readonly DataModelContextPathComponent[],
    private readonly keys: Keys,
    public readonly currentModel: DataModel | undefined,
    public readonly root: DataModelRoot,
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

  public pathComponentAt(index: number): DataModelContextPathComponent {
    return this.path[index];
  }

  public get lastPathComponent(): DataModelContextPathComponent | undefined {
    return this.path[this.path.length - 1];
  }

  private push(schemaContext: DataSchemaContext, pathComponent: DataModelContextPathComponent): DataModelContext {
    const contextKey = schemaContext.contextKey();
    return new DataModelContext(
      schemaContext,
      [...this.path, pathComponent],
      contextKey === undefined ? addKeysDepth(this.keys) : [...this.keys, contextKey],
      getModelByPathComponent(this.currentModel, pathComponent),
      this.root,
    );
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
    return this.push(this.schemaContext.dig(mapKey), {type: 'map_k', key: mapKey});
  }

  public pushMapIndex(index: number, key: string | null): DataModelContext {
    return this.push(this.schemaContext.dig(key), {type: 'map_i', index, key});
  }

  public pushMapIndexOrKey(mapKey: string): DataModelContext {
    const indexOrFalsy = dataModelIsMap(this.currentModel) && getMapDataIndexAt(this.currentModel, mapKey);
    return typeof indexOrFalsy === 'number' ? this.pushMapIndex(indexOrFalsy, mapKey) : this.pushMapKey(mapKey);
  }

  public pushIsParentKey(): DataModelContext {
    return new DataModelContext(this.schemaContext.dig({t: 'key'}), this.path, this.keys, undefined, this.root);
  }

  public pop(popCount = 1): DataModelContext {
    const poppedPath = this.path.slice(0, -popCount);
    return new DataModelContext(
      this.schemaContext.back(popCount),
      poppedPath,
      popKeys(this.keys, popCount),
      getModelByPath(this.root.model, poppedPath),
      this.root,
    );
  }

  public get parentKeyDataModel(): StringDataModel | undefined {
    const lastPathComponent = this.path[this.path.length - 1];
    switch (lastPathComponent.type) {
      case 'list':
        return stringToDataModel(`${lastPathComponent.index}`);
      case 'map_i':
        return typeof lastPathComponent.key === 'string' ? stringToDataModel(lastPathComponent.key) : undefined;
      case 'map_k':
        return lastPathComponent.key;
    }
  }

  public getModelFromRoot(rootModel: DataModel | undefined): DataModel | undefined {
    return getModelByPath(rootModel, this.path);
  }
}

// TODO DataModelContextにDataModelまで含めればこの関数は要らなくなりそう
export function dataModelForPathStart(
  root: DataModelRoot,
  current: DataModel | undefined,
  path: AnyDataPath,
  context: DataModelContext,
): [DataModel | undefined, DataModelContext] {
  if (path.isAbsolute) {
    return [root.model, DataModelContext.createRoot(root)];
  }

  let reverseCount = path.r ?? 0;
  if (path.ctx) {
    reverseCount += context.depthFromKey(path.ctx);
  }
  return reverseCount > 0
    ? [context.pop(reverseCount).getModelFromRoot(root.model), context.pop(reverseCount)]
    : [current, context];
}
