import {NamedItemNode} from './commonTypes';

export function getNamedNode<T>(node: NamedItemNode<T>, path: string[]): NamedItemNode<T> {
  if (path.length === 0) {
    return node;
  }
  const [head, ...tail] = path;
  const childNode = node.children?.get(head);
  if (!childNode) {
    throw new Error(`child for key ${head} not found`);
  }
  return tail.length > 0 ? getNamedNode(childNode, tail) : childNode;
}

export class NamedItemManager<T> {
  private current: NamedItemNode<T>;

  public constructor(private rootNode: NamedItemNode<T>, private currentPath: string[] = []) {
    this.current = getNamedNode(rootNode, currentPath);
  }

  public dig(key: string): NamedItemManager<T> {
    return new NamedItemManager<T>(this.rootNode, [...this.currentPath, key]);
  }

  public digForGetKey(key: string): NamedItemManager<T> {
    const splitKey = key.split('.');
    if (splitKey.length === 1) {
      return this;
    } else if (splitKey.length === 2) {
      return this.dig(splitKey[0]);
    } else {
      throw new Error(`invalid dig key ${key}`);
    }
  }

  public resolve(keyOrContent: T): [T, NamedItemManager<T>] {
    if (typeof keyOrContent === 'string') {
      return [this.get(keyOrContent), this.digForGetKey(keyOrContent)];
    } else {
      return [keyOrContent, this];
    }
  }

  public get(key: string): T {
    const splitKey = key.split('.');
    if (splitKey.length === 1) {
      const named = this.current.named?.get(key);
      if (!named) {
        throw new Error(`named node ${key} not found.`);
      }
      return named;
    } else if (splitKey.length === 2) {
      const child = this.current.children?.get(splitKey[0]);
      if (!child) {
        throw new Error(`named node ${key} not found.`);
      }
      const named = child.named?.get(splitKey[1]);
      if (!named) {
        throw new Error(`named node ${key} not found.`);
      }
      return named;
    } else {
      throw new Error(`invalid named key ${key}`);
    }
  }
}
