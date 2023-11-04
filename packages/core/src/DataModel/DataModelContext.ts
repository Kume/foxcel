import {DataModel, DataPointer, StringDataModel} from './DataModelTypes';
import {DataSchemaContext, DataSchemaContextKeyItem, DataSchemaExcludeRecursive} from './DataSchema';
import {dataModelIsMap, findMapDataIndexOfKey, getMapDataPointerAtIndex, stringToDataModel} from './DataModel';
import {
  AnyDataPath,
  EditingForwardDataPath,
  EditingForwardDataPathComponent,
  toListIndexDataPathComponent,
  toMapKeyDataPathComponent,
  toPointerPathComponent,
} from './DataPath';
import {getDataModelByForwardPath} from './DataModelCollector';

export interface DataModelContextListPathComponent {
  readonly type: 'list';
  readonly index: number;
  readonly p?: DataPointer;
}

export interface DataModelContextMapPathComponent {
  readonly type: 'map';
  /**
   * mapで編集中でまだkeyを入力してない時などにundefinedになり得る
   */
  readonly key: string | undefined;
  readonly p?: DataPointer;
}

type Keys = readonly (string | number)[];

export interface SerializedDataModelContext {
  readonly path: readonly DataModelContextPathComponent[];
  readonly keys: Keys;
  readonly isKey?: boolean;
}

export type DataModelContextPathComponent = DataModelContextListPathComponent | DataModelContextMapPathComponent;

export interface DataModelRoot {
  readonly model: DataModel | undefined;
  readonly schema: DataSchemaExcludeRecursive;
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

/**
 *
 * Note: DataSchemaContextは再帰で巻き戻ることがあるが、こちらは常に降下するのみなので、機能をまとめることはできない。
 */
export class DataModelContext {
  public static deserialize(serialized: SerializedDataModelContext, root: DataModelRoot): DataModelContext {
    let schemaContext = DataSchemaContext.createRootContext(root.schema);
    for (const pathComponent of serialized.path) {
      switch (pathComponent.type) {
        case 'map':
          schemaContext = schemaContext.dig(pathComponent.key);
          break;
        case 'list':
          schemaContext = schemaContext.dig(pathComponent.index);
      }
    }
    const modelContext = new DataModelContext(schemaContext, serialized.path, serialized.keys);
    return serialized.isKey ? modelContext.pushIsParentKey() : modelContext;
  }

  public static createRoot(root: DataModelRoot): DataModelContext {
    return new DataModelContext(DataSchemaContext.createRootContext(root.schema), [], []);
  }

  private constructor(
    public readonly schemaContext: DataSchemaContext,
    private readonly path: readonly DataModelContextPathComponent[],
    private readonly keys: Keys,
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
    );
  }

  public pushMapKey(mapKey: string): DataModelContext {
    return this.push(this.schemaContext.dig(mapKey), {type: 'map', key: mapKey});
  }

  public pushMapPointer(mapKey: string | undefined, pointer: DataPointer): DataModelContext {
    return this.push(this.schemaContext.dig(mapKey), {type: 'map', key: mapKey, p: pointer});
  }

  public pushMapKeyOrPointer(dataModel: DataModel | undefined, mapKey: string): DataModelContext {
    if (dataModelIsMap(dataModel)) {
      const mapKeyIndex = findMapDataIndexOfKey(dataModel, mapKey);
      const mapKeyPointer = mapKeyIndex === undefined ? undefined : getMapDataPointerAtIndex(dataModel, mapKeyIndex);
      if (mapKeyPointer) {
        return this.pushMapPointer(mapKey, mapKeyPointer);
      }
    }
    return this.pushMapKey(mapKey);
  }

  public pushListPointer(index: number, pointer: DataPointer | undefined): DataModelContext {
    return this.push(this.schemaContext.dig(index), {type: 'list', index, p: pointer});
  }

  public pushIsParentKey(): DataModelContext {
    return new DataModelContext(this.schemaContext.dig({t: 'key'}), this.path, this.keys);
  }

  public pop(popCount = 1): DataModelContext {
    return new DataModelContext(
      this.schemaContext.back(popCount),
      this.path.slice(0, -popCount),
      popKeys(this.keys, popCount),
    );
  }

  public get parentKeyDataModel(): StringDataModel | undefined {
    const lastPathComponent = this.path[this.path.length - 1];
    switch (lastPathComponent.type) {
      case 'list':
        return stringToDataModel(lastPathComponent.index.toString());
      case 'map':
        return typeof lastPathComponent.key === 'string' ? stringToDataModel(lastPathComponent.key) : undefined;
    }
  }

  public toDataPath(): EditingForwardDataPath {
    // TODO 本当はisAbsoluteにしたいが、EditingForwardDataPathはそれを許容してない
    //      UIModelにセットするDataPathは必ずrootからなのだから、DataPathとは扱いを変えるべきかもしれない
    return {
      components: this.path.map((i): EditingForwardDataPathComponent => {
        switch (i.type) {
          case 'list':
            return i.p ? toPointerPathComponent(i.p) : toListIndexDataPathComponent(i.index);
          case 'map':
            return i.p ? toPointerPathComponent(i.p) : toMapKeyDataPathComponent(i.key!);
        }
      }),
    };
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
    ? [getDataModelByForwardPath(root.model, context.pop(reverseCount).toDataPath()), context.pop(reverseCount)]
    : [current, context];
}
