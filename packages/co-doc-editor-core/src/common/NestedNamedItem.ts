import {NamedItemNode} from './commonTypes';

export class NestedNamedItem<T> {
  public constructor(public readonly root: NamedItemNode<T>) {}

  public resolve(ref: string, namespaceRef: string | undefined, namespace: readonly string[]): T | undefined {
    let node = this.getNodeForNamespace(namespace);
    if (namespaceRef) {
      namespace = [...namespace, namespaceRef];
      node = this.getChildNode(node, namespaceRef, namespace);
    }
    return this.getNamedItem(node, ref, namespace);
  }

  private getNamedItem(node: NamedItemNode<T>, name: string, namespace: readonly string[]): T {
    const item = node.named?.get(name);
    if (!item) {
      throw new Error(`named item not found for ${namespace.join()}`);
    }
    return item;
  }

  private getChildNode(node: NamedItemNode<T>, name: string, namespace: readonly string[]): NamedItemNode<T> {
    const childNode = node.children?.get(name);
    if (!childNode) {
      throw new Error(`named node not found for ${namespace.join()}`);
    }
    return childNode;
  }

  private getNodeForNamespace(namespace: readonly string[]): NamedItemNode<T> {
    let currentNode: NamedItemNode<T> = this.root;
    const currentNamespace: string[] = [];
    namespace.forEach((name) => {
      currentNamespace.push(name);
      currentNode = this.getChildNode(currentNode, name, currentNamespace);
    });
    return currentNode;
  }
}
