/**
 * ファイル毎に定義された名前付き要素、またはファイル参照先をまとめた型です。
 * 主にスキーマファイルを解析しやすくするための一時的な型としての利用を想定しています。
 */
export interface WritableFileBaseNamedItemNode<T> {
  /**
   * 名前付きの別ファイルへの参照です。
   */
  refs?: Map<string, WritableFileBaseNamedItemNode<T>>;

  /**
   * ファイル内で定義された名前付きの要素です。
   */
  named?: Map<string, T>;

  /**
   * このデータが格納されているファイルのパス(メインスキーマからの相対パス)です。
   * 本質的には不要な情報ですが、実装を簡易にするために用意しています。
   */
  filePath: readonly string[];
}

/**
 * WritableFileBaseNamedItemNodeをファイルパス("/"で結合したメインスキーマからの相対パス)毎に格納します。
 */
export type WritableFilePathConfigNamedItemMap<T> = Map<string, WritableFileBaseNamedItemNode<T>>;

export interface FileBaseNamedItemNode<T> {
  /**
   * @see WritableFileBaseNamedItemNode.refs
   */
  readonly refs?: ReadonlyMap<string, FileBaseNamedItemNode<T>>;

  /**
   * @see WritableFileBaseNamedItemNode.named
   */
  readonly named?: ReadonlyMap<string, T>;

  /**
   * @see WritableFileBaseNamedItemNode.filePath
   */
  readonly filePath: readonly string[];
}

export type FilePathConfigNamedItemMap<T> = ReadonlyMap<string, Readonly<FileBaseNamedItemNode<T>>>;

export interface CommonReferenceSchema {
  readonly ref: string;
  readonly namespaceRef?: string;
  readonly namespace: readonly string[];
}
