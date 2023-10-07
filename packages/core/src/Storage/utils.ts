import DataStorage from './DataStorage';
import {DataFormatter} from './DataFormatter';
import {resolvePath} from '../common/utils';
import {WritableFileBaseNamedItemNode, WritableFilePathConfigNamedItemMap} from '../common/commonTypes';

type ConfigMap<Config> = {readonly [key: string]: string | Config};

/**
 * 複数ファイルに分割されたスキーマファイルをロードします。
 * 分割されたスキーマファイルは{referenceName: 'path/to/other_schema', localName: {schema: 'definition'}}の形式を想定しています。
 * スキーマ定義はstring以外であれば何でもよく、その中身まではこの関数では扱いません。
 * スキーマの中身の解析はこの後の処理で行う想定で、この関数ではファイルをすべて読み込み、
 * データ構造をメモリ上に扱いやすい形で格納することを目的としています。
 *
 * この関数の出力は引数に指定された loadedItems に値を書き込む形で行われます。
 */
export async function loadNestedConfigFile<Config>(
  subConfig: ConfigMap<Config>,
  namedResultNode: WritableFileBaseNamedItemNode<Config>,
  loadedItems: WritableFilePathConfigNamedItemMap<Config>,
  validateConfig: (source: unknown, filePath: readonly string[]) => asserts source is ConfigMap<Config>,
  storage: DataStorage,
  formatter: DataFormatter,
  currentPath: readonly string[] = [],
): Promise<void> {
  // 再帰に必要なパラメーターは少ないので、別途再帰用関数を定義して、それを実行する。
  const loadRecursive = async (
    subConfig: ConfigMap<Config>,
    namedResultNode: WritableFileBaseNamedItemNode<Config>,
    currentPath: readonly string[],
  ): Promise<void> => {
    for (const [name, schemaOrReference] of Object.entries(subConfig)) {
      if (typeof schemaOrReference === 'string') {
        const splitPath = schemaOrReference.split('/');
        const childFilePath = resolvePath(currentPath, splitPath);
        const loadedItem = loadedItems.get(childFilePath.join('/'));
        if (loadedItem) {
          namedResultNode.refs = (namedResultNode.refs ?? new Map()).set(name, loadedItem);
        } else {
          const childNode: WritableFileBaseNamedItemNode<Config> = {filePath: childFilePath};
          namedResultNode.refs = (namedResultNode.refs ?? new Map()).set(name, childNode);
          loadedItems.set(childFilePath.join('/'), childNode);
          const childConfigContent = await storage.loadAsync(resolvePath(currentPath, splitPath));
          const childConfig = formatter.parse(childConfigContent);
          validateConfig(childConfig, childFilePath);
          await loadRecursive(childConfig, childNode, resolvePath(currentPath, splitPath.slice(0, -1)));
        }
      } else {
        namedResultNode.named = (namedResultNode.named ?? new Map()).set(name, schemaOrReference);
      }
    }
  };
  await loadRecursive(subConfig, namedResultNode, currentPath);
}
