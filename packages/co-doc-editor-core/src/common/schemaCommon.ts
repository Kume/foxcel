import {NamedItemNode} from './commonTypes';

export type LoadedSchemaPath<T = never> = readonly (readonly [readonly string[], string | null, T?])[];
export type PathConfigMap<T> = ReadonlyMap<string, Readonly<NamedItemNode<T>>>;

function recursiveSchemaDepth<T, S>(
  filePath: readonly string[],
  name: string,
  loadedPath: LoadedSchemaPath<S>,
): number {
  const index = loadedPath.findIndex(
    ([loadedFilePath, loadedName]) => filePath.join('/') === loadedFilePath.join('/') && name === loadedName,
  );
  if (index < 0) {
    return index;
  } else {
    return loadedPath.length - index;
  }
}

export type ConfigOrRecursive<T, S> = {
  readonly filePath: readonly string[];
  readonly loadedPath: LoadedSchemaPath<S>;
} & (
  | {
      readonly type: 'recursive';
      readonly depth: number;
      readonly additionalPathInfo: S | undefined;
    }
  | {
      readonly type: 'config';
      readonly config: T;
    }
);

export function resolveConfigOrRecursive<T, S = never>(
  configOrReference: T | string,
  pathConfigMap: PathConfigMap<T>,
  filePath: readonly string[],
  loadedPath: LoadedSchemaPath<S>,
  additionalPathInfo?: S,
): ConfigOrRecursive<T, S> {
  if (typeof configOrReference === 'string') {
    const config = pathConfigMap.get(filePath.join('/'));
    if (!config) {
      throw new Error(''); // TODO 自身のファイルパスの設定が見つからなかった。バグがない限りは起こらないエラー。
    }
    const [name, nestedName] = configOrReference.split('.');
    if (nestedName) {
      const childNode = config.children?.get(name);
      if (!childNode) {
        if (config.named?.has(name)) {
          throw new Error(''); // TODO エラー処理 同ファイル内に定義があるので、 xxxx.yyy 形式の参照指定は不正
        } else {
          console.log('---------------------');
          console.log(name, nestedName);
          console.log(config);
          console.log('---------------------');
          console.log(pathConfigMap);
          throw new Error(`${name} not found.`); // TODO エラー処理 指定された識別子がどこにもなかった
        }
      }
      const childConfig = childNode.named?.get(nestedName);
      if (!childConfig) {
        if (childNode.children?.has(name)) {
          throw new Error(''); // TODO エラー処理 ファイルを２つ跨いで参照することはできない
        } else {
          throw new Error(''); // TODO エラー処理 指定された識別子が参照先のファイルのどこにもなかった
        }
      }
      const recursiveDepth = recursiveSchemaDepth(childNode.filePath, nestedName, loadedPath);
      if (recursiveDepth >= 0) {
        const targetNode = loadedPath[loadedPath.length - recursiveDepth];
        return {
          type: 'recursive',
          depth: recursiveDepth,
          filePath: targetNode[0],
          loadedPath: loadedPath.slice(0, -recursiveDepth),
          additionalPathInfo: targetNode[2],
        };
      } else {
        const nextLoadedPath = [...loadedPath, [childNode.filePath, nestedName, additionalPathInfo] as const];
        return {type: 'config', config: childConfig, filePath: childNode.filePath, loadedPath: nextLoadedPath};
      }
    } else {
      const childConfig = config.named?.get(name);
      if (!childConfig) {
        if (config.children?.has(name)) {
          throw new Error(''); // TODO エラー処理 定義は別ファイルにあるので、 xxxx 形式の参照指定は不正
        } else {
          throw new Error(''); // TODO エラー処理 指定された識別子がどこにもなかった
        }
      }
      const recursiveDepth = recursiveSchemaDepth(filePath, name, loadedPath);
      if (recursiveDepth >= 0) {
        const targetNode = loadedPath[loadedPath.length - recursiveDepth];
        return {
          type: 'recursive',
          depth: recursiveDepth,
          filePath: targetNode[0],
          loadedPath: loadedPath.slice(0, -recursiveDepth),
          additionalPathInfo: targetNode[2],
        };
      } else {
        const nextLoadedPath = [...loadedPath, [filePath, nestedName, additionalPathInfo] as const];
        return {type: 'config', config: childConfig, filePath, loadedPath: nextLoadedPath};
      }
    }
  } else {
    const nextLoadedPath = [...loadedPath, [filePath, null, additionalPathInfo] as const];
    return {type: 'config', config: configOrReference, filePath, loadedPath: nextLoadedPath};
  }
}
