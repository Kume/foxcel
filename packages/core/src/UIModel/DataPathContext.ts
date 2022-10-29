import {
  dataPathComponentIsPointer,
  emptyDataPath,
  ForwardDataPath,
  ForwardDataPathComponent,
  forwardDataPathComponentEquals,
  forwardDataPathEquals,
  PointerPathComponent,
  pushDataPath,
  toMapKeyDataPathComponent,
} from '../DataModel/DataPath';
import {UISchemaExcludeRecursive, UISchemaKey, uiSchemaKeyIsParentKey} from './UISchema';
import {DataModel, DataPointer, MapDataModel} from '../DataModel/DataModelTypes';
import {getMapDataAtPathComponent} from '../DataModel/DataModel';

export type UIModelDataPathContext = {readonly parentPath: ForwardDataPath} & (
  | {readonly isKey: true; readonly selfPointer: DataPointer; key: string | null}
  | {readonly isKey?: void; readonly self: ForwardDataPathComponent; key?: string | null}
);

export function buildDataPathFromUIModelDataPathContext(
  context: UIModelDataPathContext | undefined,
  schema: UISchemaExcludeRecursive,
): ForwardDataPath {
  if (!context) {
    if (schema.key) {
      // TODO エラーハンドリング
      throw new Error('Root ui schema cannot have key.');
    } else {
      return emptyDataPath;
    }
  }

  if (context.isKey) {
    // TODO エラーハンドリング
    throw new Error('Forward data path cannot contain parent key.');
  }
  return pushDataPath(context.parentPath, context.self);
}

export function makeKeyUIModelDataPathContext(
  parentContext: UIModelDataPathContext | undefined,
): UIModelDataPathContext {
  if (!parentContext || parentContext.isKey) {
    // TODO エラーハンドリング
    throw new Error('invalid data path context for key child.');
  }
  if (parentContext.key === undefined) {
    // TODO エラーハンドリング
    throw new Error('key is unknown in this context.');
  }
  return {
    parentPath: parentContext.parentPath,
    isKey: true,
    // 一見親のcontextのkeyをそのまま渡しているのが不自然に見えるが、これは意図したもの。
    // 必要なkeyは親(contentListなど)でセットされる想定。
    key: parentContext.key,
    selfPointer: ensurePointerPathComponent(parentContext.self),
  };
}

// TODO 以下のメソッドはこのファイルに置くべきではないかも

export function ensurePointerPathComponent(pathComponent: ForwardDataPathComponent): PointerPathComponent {
  if (dataPathComponentIsPointer(pathComponent)) {
    return pathComponent;
  }
  // TODO エラーハンドリング
  throw new Error('path component is not pointer path.');
}

export function stringUISchemaKeyToDataPathComponent(key: string | undefined): ForwardDataPathComponent {
  if (key === undefined) {
    throw new Error('content must have key.');
  }
  return toMapKeyDataPathComponent(key);
}

export function uiSchemaKeyToDataPathComponent(key: UISchemaKey | undefined): ForwardDataPathComponent {
  if (key === undefined) {
    throw new Error('content must have key.');
  }
  if (uiSchemaKeyIsParentKey(key)) {
    throw new Error('cannot convert parent key to data path component.');
  }
  return toMapKeyDataPathComponent(key);
}

export function getChildDataModelByUISchemaKey(
  model: MapDataModel | undefined,
  key: UISchemaKey | undefined,
): DataModel | undefined {
  if (model === undefined || key === undefined || uiSchemaKeyIsParentKey(key)) {
    return undefined;
  }
  return getMapDataAtPathComponent(model, stringUISchemaKeyToDataPathComponent(key));
}

export function uiModelDataPathContextEquals(
  lhs: UIModelDataPathContext | undefined,
  rhs: UIModelDataPathContext | undefined,
): boolean {
  if (lhs === undefined || rhs === undefined) {
    return lhs === rhs;
  }
  if (lhs.isKey) {
    return !!rhs.isKey && lhs.key === rhs.key && forwardDataPathEquals(lhs.parentPath, rhs.parentPath);
  } else {
    return (
      !rhs.isKey &&
      forwardDataPathEquals(lhs.parentPath, rhs.parentPath) &&
      forwardDataPathComponentEquals(lhs.self, rhs.self)
    );
  }
}
