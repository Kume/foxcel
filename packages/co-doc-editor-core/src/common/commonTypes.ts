export interface NamedItemNode<T> {
  children?: Map<string, NamedItemNode<T>>;
  named?: Map<string, T>;
  filePath: string[];
}

export interface CommonReferenceSchema {
  readonly ref: string;
  readonly namespaceRef?: string;
  readonly namespace: readonly string[];
}
