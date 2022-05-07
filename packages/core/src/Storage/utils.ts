import DataStorage from './DataStorage';
import {DataFormatter} from './DataFormatter';
import {addChildToNamedItemNode, addNamedItemToNamedItemNode, resolvePath} from '../common/utils';
import {NamedItemNode} from '../common/commonTypes';

export async function loadNestedConfigFile<C, R>(
  subConfig: {readonly [key: string]: string | C},
  namedResultNode: NamedItemNode<R>,
  loadedItems: Map<string, NamedItemNode<R>>,
  validateConfig: (
    source: unknown,
    filePath: readonly string[],
  ) => asserts source is {readonly [key: string]: string | C},
  parse: (config: C, filePath: readonly string[]) => R,
  storage: DataStorage,
  formatter: DataFormatter,
  currentPath: readonly string[] = [],
): Promise<void> {
  for (const name of Object.keys(subConfig)) {
    const schemaOrReference = subConfig[name];
    if (typeof schemaOrReference === 'string') {
      const splitPath = schemaOrReference.split('/');
      const childFilePath = resolvePath(currentPath, splitPath);
      const loadedItem = loadedItems.get(childFilePath.join('/'));
      if (loadedItem) {
        addChildToNamedItemNode(namedResultNode, name, loadedItem);
      } else {
        const childNode: NamedItemNode<R> = {filePath: childFilePath};
        addChildToNamedItemNode(namedResultNode, name, childNode);
        loadedItems.set(childFilePath.join('/'), childNode);
        const childConfigContent = await storage.loadAsync(resolvePath(currentPath, splitPath));
        const childConfig = formatter.parse(childConfigContent);
        validateConfig(childConfig, childFilePath);
        await loadNestedConfigFile(
          childConfig,
          childNode,
          loadedItems,
          validateConfig,
          parse,
          storage,
          formatter,
          resolvePath(currentPath, splitPath.slice(0, -1)),
        );
      }
    } else {
      addNamedItemToNamedItemNode(namedResultNode, name, parse(schemaOrReference, currentPath));
    }
  }
}
