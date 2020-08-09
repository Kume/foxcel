import {NamedItemNode} from './commonTypes';

export function mapObjectToObject<V, R>(
  obj: {[key: string]: V},
  mapper: (value: V, key: string) => R,
): {readonly [key: string]: R} {
  const ret: {[key: string]: R} = {};
  for (const key of Object.keys(obj)) {
    ret[key] = mapper(obj[key], key);
  }
  return ret;
}

export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R | undefined] | undefined,
  ignoreUndefined: true,
): {[key: string]: R};
export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R] | undefined,
  ignoreUndefined?: false,
): {[key: string]: R};
export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R] | undefined,
  ignoreUndefined?: boolean,
): {[key: string]: R} {
  const ret: {[key: string]: R} = {};
  for (let i = 0; i < values.length; i++) {
    const mapped = mapper(values[i], i);
    if (mapped) {
      const [key, value] = mapped;
      if (!ignoreUndefined || value !== undefined) {
        ret[key] = value;
      }
    }
  }
  return ret;
}

export function addChildToNamedItemNode<T>(node: NamedItemNode<T>, name: string, child: NamedItemNode<T>): void {
  if (!node.children) {
    node.children = new Map();
  }
  node.children.set(name, child);
}

export function addNamedItemToNamedItemNode<T>(node: NamedItemNode<T>, name: string, item: T): void {
  if (!node.named) {
    node.named = new Map();
  }
  node.named.set(name, item);
}

export function resolvePath(currentPath: readonly string[], targetPath: readonly string[]): string[] {
  const path = [...currentPath, ...targetPath];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '..') {
      if (i === 0) {
        throw new Error('Cannot reference above the top directory');
      }
      path.splice(i - 1, 2);
      i--;
    } else {
      i++;
    }
  }
  return path;
}
