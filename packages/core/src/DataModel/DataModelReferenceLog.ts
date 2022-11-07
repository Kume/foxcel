import {DataModel, ListDataModel, MapDataModel} from './DataModelTypes';
import {
  dataModelIsList,
  dataModelIsMap,
  getListDataAt,
  getMapDataAtIndex,
  getMapDataAtWithIndexCache,
  getMapDataKeys,
  listDataSize,
} from './DataModel';
import {
  DataModelContext,
  dataModelContextDepth,
  DataModelContextPathComponent,
  dataModelContextPathComponentAt,
  dataModelContextNodeIsMap,
  dataModelContextNodeIsList,
} from './DataModelContext';

export interface DataModelReferenceLogMapNode {
  readonly type: 'map';
  readonly data: MapDataModel;
  readonly children: {
    readonly [key: string]: readonly [indexCache: number, node: DataModelReferenceLogNode];
  };
  readonly missings: readonly string[];
}

export interface DataModelReferenceLogListNode {
  readonly type: 'list';
  readonly data: ListDataModel;
  readonly children: {
    readonly [index: number]: DataModelReferenceLogNode;
  };
  readonly missings: readonly number[];
}

export interface DataModelReferenceLogLeafNode {
  readonly type: 'leaf';
  readonly data: DataModel;
}

export interface DataModelReferenceLogOffsetNode {
  readonly type: 'offset';
  readonly data: DataModel;
  readonly offset: readonly ([indexCache: number, key: string] | number)[];
  readonly child: DataModelReferenceLogNode;
}

export type DataModelReferenceLogNode =
  | DataModelReferenceLogMapNode
  | DataModelReferenceLogListNode
  | DataModelReferenceLogLeafNode;

interface WritableDataModelReferenceLogMapNode {
  readonly type: 'map';
  readonly data: MapDataModel;
  readonly children: Map<string, [indexCache: number, node: WritableDataModelReferenceLogNode]>;
  readonly missings: Set<string>;
}

interface WritableDataModelReferenceLogListNode {
  readonly type: 'list';
  readonly data: ListDataModel;
  readonly children: Map<number, WritableDataModelReferenceLogNode>;
  readonly missings: Set<number>;
}

export type WritableDataModelReferenceLogNode =
  | WritableDataModelReferenceLogMapNode
  | WritableDataModelReferenceLogListNode
  | DataModelReferenceLogLeafNode;

export interface DataModelReferenceLogMatchResultMapNode {
  readonly type: 'map';
  readonly children: Map<string, DataModelReferenceLogMatchResultNode | undefined>;
  readonly keys: Set<string | null>;
}

export interface DataModelReferenceLogMatchResultListNode {
  readonly type: 'list';
  readonly children: Map<number, DataModelReferenceLogMatchResultNode | undefined>;
  readonly length: number;
}

export interface DataModelReferenceLogMatchResultMatchNode {
  readonly type: 'match';
}

export type DataModelReferenceLogMatchResultNode =
  | DataModelReferenceLogMatchResultMapNode
  | DataModelReferenceLogMatchResultListNode
  | DataModelReferenceLogMatchResultMatchNode;

function makeEmptyWritableDataModelReferenceLogMapNode(data: MapDataModel): WritableDataModelReferenceLogMapNode {
  return {type: 'map', data, children: new Map(), missings: new Set()};
}

function makeEmptyWritableDataModelReferenceLogListNode(data: ListDataModel): WritableDataModelReferenceLogListNode {
  return {type: 'list', data, children: new Map(), missings: new Set()};
}

function writableDataModelReferenceLogNodeToReadonly(
  writable: WritableDataModelReferenceLogNode,
): DataModelReferenceLogNode {
  switch (writable.type) {
    case 'leaf':
      return writable;
    case 'map': {
      const children: {[key: string]: readonly [indexCache: number, node: DataModelReferenceLogNode]} = {};
      writable.children.forEach(
        (value, key) => (children[key] = [value[0], writableDataModelReferenceLogNodeToReadonly(value[1])]),
      );
      return {
        type: 'map',
        data: writable.data,
        children,
        missings: Array.from(writable.missings),
      };
    }
    case 'list': {
      const children: {[index: number]: DataModelReferenceLogNode} = {};
      writable.children.forEach(
        (value, index) => (children[index] = writableDataModelReferenceLogNodeToReadonly(value)),
      );
      return {
        type: 'list',
        data: writable.data,
        children,
        missings: Array.from(writable.missings),
      };
    }
  }
}

function dataModelReferenceLogNodeToWritable(node: DataModelReferenceLogNode): WritableDataModelReferenceLogNode {
  switch (node.type) {
    case 'leaf':
      return node;
    case 'map':
      return {
        type: 'map',
        data: node.data,
        children: new Map(
          Object.keys(node.children).map((key) => {
            const child = node.children[key]!;
            return [key, [child[0], dataModelReferenceLogNodeToWritable(child[1])]];
          }),
        ),
        missings: new Set(node.missings),
      };
    case 'list':
      return {
        type: 'list',
        data: node.data,
        children: new Map(
          Object.keys(node.children).map((key) => {
            const index = Number(key);
            return [index, dataModelReferenceLogNodeToWritable(node.children[index]!)];
          }),
        ),
        missings: new Set(node.missings),
      };
  }
}

function mergeDataModelReferenceLogNodeWithWritable(
  writable: WritableDataModelReferenceLogNode | undefined,
  merging: DataModelReferenceLogNode | undefined,
): WritableDataModelReferenceLogNode | undefined {
  if (!merging) {
    return writable;
  }
  if (!writable) {
    return dataModelReferenceLogNodeToWritable(merging);
  }
  switch (merging.type) {
    case 'leaf':
      return writable;
    case 'map': {
      if (writable.type !== merging.type) {
        throw new Error('DataModelReferenceLog type not match.');
      }

      for (const key of Object.keys(merging.children)) {
        // Object.keysでkeyを作成しているため、必ず見つかるはず。
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const child = merging.children[key]!;
        const writableChild = writable.children.get(key);
        const updatedWritableChild = mergeDataModelReferenceLogNodeWithWritable(writableChild?.[1], child[1]);
        if (!writableChild && updatedWritableChild) {
          writable.children.set(key, [child[0], updatedWritableChild]);
        }
      }
      merging.missings.forEach((key) => writable.missings.add(key));
      return writable;
    }
    case 'list': {
      if (writable.type !== merging.type) {
        throw new Error('DataModelReferenceLog type not match.');
      }
      for (const key of Object.keys(merging.children)) {
        const index = Number(key);
        // Object.keysでindexを作成しているため、必ず見つかるはず。
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const child = merging.children[index]!;
        const writableChild = writable.children.get(index);
        const updatedWritableChild = mergeDataModelReferenceLogNodeWithWritable(writableChild, child);
        if (!writableChild && updatedWritableChild) {
          writable.children.set(index, updatedWritableChild);
        }
      }

      merging.missings.forEach((key) => writable.missings.add(key));
      return writable;
    }
  }
}

export function mergeDataModelReferenceLogNodes(
  nodes: readonly (DataModelReferenceLogNode | undefined)[],
): DataModelReferenceLogNode | undefined {
  const nonEmptyNodes = nodes.filter((node) => !!node) as DataModelReferenceLogNode[];
  if (nonEmptyNodes.length <= 1) {
    return nonEmptyNodes[0];
  }
  const writable = dataModelReferenceLogNodeToWritable(nonEmptyNodes[0]);
  for (let i = 1; i < nonEmptyNodes.length; i++) {
    mergeDataModelReferenceLogNodeWithWritable(writable, nonEmptyNodes[i]);
  }
  return writableDataModelReferenceLogNodeToReadonly(writable);
}

function dataModelToWritableReferencePathNode(model: DataModel): WritableDataModelReferenceLogNode {
  if (dataModelIsMap(model)) {
    return makeEmptyWritableDataModelReferenceLogMapNode(model);
  } else if (dataModelIsList(model)) {
    return makeEmptyWritableDataModelReferenceLogListNode(model);
  } else {
    return {type: 'leaf', data: model};
  }
}

function dataModelContextNodeToWritableReferenceLog(
  contextNode: DataModelContextPathComponent,
): WritableDataModelReferenceLogNode {
  if (dataModelContextNodeIsMap(contextNode)) {
    return makeEmptyWritableDataModelReferenceLogMapNode(contextNode.data);
  }
  if (dataModelContextNodeIsList(contextNode)) {
    return makeEmptyWritableDataModelReferenceLogListNode(contextNode.data);
  }
  // TODO
  throw new Error('Not implemented');
}

function writeReferenceLogImpl(
  node: WritableDataModelReferenceLogNode | undefined,
  data: DataModel,
  context: DataModelContext,
  currentContextDepth: number,
): WritableDataModelReferenceLogNode {
  const contextDepth = dataModelContextDepth(context);
  if (currentContextDepth >= contextDepth) {
    return node ?? dataModelToWritableReferencePathNode(data);
  }
  const contextNode = dataModelContextPathComponentAt(context, currentContextDepth);
  const currentLogNode = node ?? dataModelContextNodeToWritableReferenceLog(contextNode);
  writeChildForContextNode(currentLogNode, contextNode, context, currentContextDepth, (node_, context_, depth_) =>
    writeReferenceLogImpl(node_, data, context_, depth_),
  );
  return currentLogNode;
}

function writeChildForContextNode(
  logNode: WritableDataModelReferenceLogNode,
  contextNode: DataModelContextPathComponent,
  context: DataModelContext,
  depth: number,
  getChild: (
    logNode: WritableDataModelReferenceLogNode | undefined,
    contextNode: DataModelContext,
    depth: number,
  ) => WritableDataModelReferenceLogNode,
): void {
  if (dataModelContextNodeIsMap(contextNode)) {
    if (logNode.type !== 'map') {
      throw new Error('log node type mismatch.');
    }
    const childNode = getChild(logNode.children.get(contextNode.at)?.[1], context, depth + 1);
    logNode.children.set(contextNode.at, [contextNode.indexCache, childNode]);
  } else if (dataModelContextNodeIsList(contextNode)) {
    if (logNode.type !== 'list') {
      throw new Error('log node type mismatch.');
    }
    if (contextNode.at !== undefined) {
      logNode.missings.add(contextNode.at);
    }
  }
}

export function writeReferenceLog(
  node: WritableDataModelReferenceLogNode | undefined,
  data: DataModel,
  context: DataModelContext,
): WritableDataModelReferenceLogNode {
  return writeReferenceLogImpl(node, data, context, 0);
}

function writeReferenceLogMissingImpl(
  node: WritableDataModelReferenceLogNode | undefined,
  context: DataModelContext,
  currentContextDepth: number,
): WritableDataModelReferenceLogNode {
  const contextNode = dataModelContextPathComponentAt(context, currentContextDepth);
  const currentLogNode = node ?? dataModelContextNodeToWritableReferenceLog(contextNode);
  if (currentContextDepth - 1 >= dataModelContextDepth(context)) {
    if (dataModelContextNodeIsMap(contextNode)) {
      if (currentLogNode.type !== 'map') {
        throw new Error('log node type mismatch.');
      }
      currentLogNode.missings.add(contextNode.at);
    } else if (dataModelContextNodeIsList(contextNode)) {
      if (currentLogNode.type !== 'list') {
        throw new Error('log node type mismatch.');
      }
      if (contextNode.at !== undefined) {
        currentLogNode.missings.add(contextNode.at);
      }
    }
  } else {
    writeChildForContextNode(currentLogNode, contextNode, context, currentContextDepth, writeReferenceLogMissingImpl);
  }

  return currentLogNode;
}

export function writeReferenceLogMissing(
  node: WritableDataModelReferenceLogNode | undefined,
  context: DataModelContext,
): WritableDataModelReferenceLogNode {
  if (dataModelContextDepth(context) === 0) {
    throw new Error('context is empty');
  }
  return writeReferenceLogMissingImpl(node, context, 0);
}

const matchResultMatchNode: DataModelReferenceLogMatchResultMatchNode = {type: 'match'};

export function matchDataModelReferenceLog(
  log: DataModelReferenceLogNode | undefined,
  data: DataModel | undefined,
): DataModelReferenceLogMatchResultNode | undefined {
  if (!log) {
    return undefined;
  }
  if (log.data === data) {
    return matchResultMatchNode;
  }
  switch (log.type) {
    case 'leaf':
      return undefined;
    case 'map': {
      if (!dataModelIsMap(data)) {
        // データの型が変わっているのであれば、これ以下でマッチしたデータがある可能性は低いので、マッチしなかったものとして扱う
        return undefined;
      }

      let hasMismatch = false;
      const children = new Map<string, DataModelReferenceLogMatchResultNode | undefined>();
      for (const key of Object.keys(log.children)) {
        const [indexCache, child] = log.children[key];
        const matchNode = matchDataModelReferenceLog(child, getMapDataAtWithIndexCache(data, key, indexCache));
        children.set(key, matchNode);
        if (matchNode?.type !== 'match') {
          hasMismatch = true;
        }
      }
      const dataKeys = new Set<string | null>(getMapDataKeys(data));
      for (const missingKey of log.missings) {
        if (dataKeys.has(missingKey)) {
          // 前回には存在しなかったキーが追加されている
          hasMismatch = true;
        }
      }
      return hasMismatch ? {type: 'map', children, keys: dataKeys} : matchResultMatchNode;
    }
    case 'list': {
      if (!dataModelIsList(data)) {
        // データの型が変わっているのであれが、これ以下でマッチしたデータがある可能性は低いので、マッチしなかったものとして扱う
        return undefined;
      }

      let hasMismatch = false;
      const children = new Map<number, DataModelReferenceLogMatchResultNode | undefined>();
      for (const key of Object.keys(log.children)) {
        const index = Number(key);
        const matchNode = matchDataModelReferenceLog(log.children[index], getListDataAt(data, index));
        children.set(index, matchNode);
        if (matchNode?.type !== 'match') {
          hasMismatch = true;
        }
      }
      const size = listDataSize(data);
      for (const missingIndex of log.missings) {
        if (missingIndex < size) {
          // 前回には存在しなかったインデックスまで要素が追加されている
          hasMismatch = true;
        }
      }
      return hasMismatch ? {type: 'list', children, length: size} : matchResultMatchNode;
    }
  }
}

export function dataModelReferenceLogIsMatch(
  matchResult: DataModelReferenceLogMatchResultNode | undefined,
  log: DataModelReferenceLogNode,
): boolean {
  if (!matchResult) {
    return false;
  }
  if (matchResult.type === 'match') {
    return true;
  }
  switch (log.type) {
    case 'leaf':
      // leafに来るまでmatchにぶつからなかったのであれば不一致
      return false;
    case 'map':
      if (matchResult.type !== 'map') {
        throw new Error('reference log match result type mismatch');
      }
      return (
        Object.keys(log.children).every((key) =>
          dataModelReferenceLogIsMatch(matchResult.children.get(key), log.children[key]?.[1]),
        ) && log.missings.every((key) => !matchResult.keys.has(key))
      );
    case 'list':
      if (matchResult.type !== 'list') {
        throw new Error('reference log match result type mismatch');
      }
      return (
        Object.keys(log.children).every((key) => {
          const index = Number(key);
          return dataModelReferenceLogIsMatch(matchResult.children.get(index), log.children[index]);
        }) && log.missings.every((index) => index >= matchResult.length)
      );
  }
}
