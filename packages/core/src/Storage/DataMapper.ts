import DataStorage from './DataStorage';
import {DataFormatter} from './DataFormatter';
import YamlDataFormatter from './YamlDataFormatter';
import {StorageDataTrait} from './StorageDataTrait';
import {getForPath, unknownIsObject} from './StorageCommon';
import {DataMapperConfig, DataMapperNodeConfig, dataModelToJson} from '..';

/**
 * ファイルパスとそこから読み出したデータを記録しておく木構造です。
 * 読み出した時点のファイル内容を記録し、保存時に差分を検出するのが主な利用目的です。
 * ファイルシステム上に実際に保存された構造と同じ構造と一致した形で生成されます。
 * (childrenのキーはファイル名、またはディレクトリ名となります。)
 */
export type FileDataMapNode<T> = {
  readonly data?: T;

  /**
   * DirtyFileMapNodeから復元したときに付与されるフラグで、前回シリアライズ時に既に更新済みだったことを示します。
   */
  readonly isDirty?: true;
  readonly children: {readonly [key: string]: FileDataMapNode<T>};
};

export interface FileDataStatusMapNode {
  readonly exists?: true;
  readonly isDirty?: true;
  readonly children: Readonly<Record<string, FileDataStatusMapNode>>;
}

export interface WritableFileDataStatusMapNode {
  exists?: true;
  isDirty?: true;
  children: Record<string, WritableFileDataStatusMapNode>;
}

export interface DirtyFileMapNode {
  readonly isDirty?: true;
  readonly children?: Record<string, DirtyFileMapNode>;
}

interface WritableDirtyFileMapNode {
  isDirty?: true;
  children?: Record<string, WritableDirtyFileMapNode>;
}

/**
 * FileDataMapNodeをシリアライズするためデータを除外した型です。
 * DataMapper のmapDataメソッドでFileDataMapNodeに復元します。
 *
 * 追記 : 編集中のデータを保存するという点については、「何を保存しなければならないか = dirtyなデータは何か」なので、
 * その点のみを記録すべきでは？
 */
export type FileMapNode = {
  readonly children?: {readonly [key: string]: FileMapNode};
};

type WritableFileDataMapNode<T> = {
  data?: T;
  isDirty?: true;
  children: {[key: string]: WritableFileDataMapNode<T>};
};

type MarkingFileDataMapNode<T> = {
  data?: T;
  children: {[key: string]: MarkingFileDataMapNode<T>};
  isDirty?: true;
  isMarked?: true;
};

export function markedNodeToDebugString<T>(node: MarkingFileDataMapNode<T>, parentKey: string = '$root'): string {
  const childTexts: string[] = [];
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      childTexts.push(
        markedNodeToDebugString(node.children[key], key)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n'),
      );
    }
  }
  return [`${parentKey}: ${node.isMarked ? '[!]' : ''}`, ...childTexts].join('\n');
}

export function fileMapNodeToDebugString<T>(node: FileDataMapNode<T>, parentKey = '$root'): string {
  const childTexts: string[] = [];
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      childTexts.push(
        fileMapNodeToDebugString(node.children[key], key)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n'),
      );
    }
  }
  return [`${parentKey}:${node.isDirty ? '[D]' : ''}`, ...childTexts].join('\n');
}

export function fileStatusMapNodeToDebugString(node: FileDataStatusMapNode, parentKey = '$root'): string {
  const childTexts: string[] = [];
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      childTexts.push(
        fileStatusMapNodeToDebugString(node.children[key], key)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n'),
      );
    }
  }
  return [`${parentKey}:${node.isDirty ? '[D]' : node.exists ? '[E]' : ''}`, ...childTexts].join('\n');
}

function getNodeForFilePath(node: FileDataStatusMapNode, path: readonly string[]): FileDataStatusMapNode | undefined;
function getNodeForFilePath<T>(
  node: MarkingFileDataMapNode<T>,
  path: readonly string[],
): MarkingFileDataMapNode<T> | undefined;
function getNodeForFilePath<T>(node: FileDataMapNode<T>, path: readonly string[]): FileDataMapNode<T> | undefined;
function getNodeForFilePath<T>(
  node: WritableFileDataMapNode<T>,
  path: readonly string[],
): WritableFileDataMapNode<T> | undefined;
function getNodeForFilePath<T>(
  node: WritableFileDataMapNode<T>,
  path: readonly string[],
): WritableFileDataMapNode<T> | undefined {
  if (path.length === 0) {
    return node;
  }
  const [firstPathComponent, ...childPath] = path;
  const child = node.children?.[firstPathComponent];
  if (!child) {
    return undefined;
  }
  return getNodeForFilePath(child, childPath);
}

function getOrSetDefaultNodeForFilePath<T>(
  node: WritableFileDataStatusMapNode,
  path: readonly string[],
): WritableFileDataStatusMapNode;
function getOrSetDefaultNodeForFilePath<T>(
  node: WritableFileDataMapNode<T>,
  path: readonly string[],
): WritableFileDataMapNode<T>;
function getOrSetDefaultNodeForFilePath<T>(
  node: WritableFileDataMapNode<T> | WritableFileDataStatusMapNode,
  path: readonly string[],
): WritableFileDataMapNode<T> | WritableFileDataStatusMapNode {
  if (path.length === 0) {
    return node;
  }
  const [firstPathComponent, ...childPath] = path;
  if (!node.children) {
    node.children = {};
  }
  const childNode = node.children[firstPathComponent] ?? (node.children[firstPathComponent] = {children: {}});
  return getOrSetDefaultNodeForFilePath(childNode, childPath);
}

function setModelForFilePath<T>(
  destination: WritableFileDataMapNode<T>,
  data: T | undefined,
  path: readonly string[],
  isDirty: true | undefined,
): WritableFileDataMapNode<T> | undefined {
  switch (path.length) {
    case 0:
      return destination;
    case 1:
      if (unknownIsObject(destination)) {
        if (destination.children?.[path[0]]) {
          destination.children[path[0]].data = data;
          destination.children[path[0]].isDirty = isDirty;
          return destination.children[path[0]];
        } else {
          const childNode = {data, isDirty, children: {}};
          destination.children[path[0]] = childNode;
          return childNode;
        }
      }
      return undefined;
    default:
      if (unknownIsObject(destination)) {
        const [firstPathComponent, ...childPath] = path;
        if (!destination.children) {
          destination.children = {};
        }
        if (!destination.children[firstPathComponent]) {
          destination.children[firstPathComponent] = {children: {}};
        }
        return setModelForFilePath(destination.children[firstPathComponent], data, childPath, isDirty);
      }
      return undefined;
  }
}

function toMarkingFileDataMapNode<T>(origin: FileDataMapNode<T>): MarkingFileDataMapNode<T> {
  const children: {[key: string]: MarkingFileDataMapNode<T>} = {};
  for (const key of Object.keys(origin.children)) {
    children[key] = toMarkingFileDataMapNode(origin.children[key]);
  }
  return {data: origin.data, isDirty: origin.isDirty, children};
}

function shouldSave<T>(
  storageDataTrait: StorageDataTrait<T>,
  prevNode: FileDataMapNode<T> | undefined,
  currentModel: T,
): boolean {
  // dirtyだったら確実に保存が必要
  // 前回保存時と値が変化していても保存が必要
  return (
    prevNode?.isDirty || !(prevNode?.data !== undefined && storageDataTrait.modelEquals(prevNode.data, currentModel))
  );
}

function remakeFileMapFromStatus<T>(status: FileDataStatusMapNode): WritableFileDataMapNode<T> | undefined {
  let selfNode: WritableFileDataMapNode<T> | undefined;
  const getOrSetSelfNode = () => selfNode ?? (selfNode = {children: {}});
  if (status.isDirty) {
    getOrSetSelfNode().isDirty = true;
  }
  if (status.children) {
    for (const key of Object.keys(status.children)) {
      const childNode = remakeFileMapFromStatus<T>(status.children[key]);
      if (childNode) {
        getOrSetSelfNode().children[key] = childNode;
      }
    }
  }
  return selfNode;
}

function setDirtyWithMarkingNode<T>(
  status: WritableFileDataStatusMapNode,
  marking: MarkingFileDataMapNode<T>,
): boolean {
  const childKeys = Object.keys(marking.children);
  if (Object.keys(marking.children).length > 0) {
    let isChanged = false;
    for (const childKey of childKeys) {
      const childMarkingNode = marking.children[childKey];
      if (status.children[childKey]) {
        isChanged = setDirtyWithMarkingNode(status.children[childKey], childMarkingNode) || isChanged;
      } else {
        const childStatusNode: WritableFileDataStatusMapNode = {children: {}};
        if (setDirtyWithMarkingNode(childStatusNode, childMarkingNode)) {
          status.children[childKey] = childStatusNode;
          isChanged = true;
        }
      }
    }
    return isChanged;
  } else {
    if (!marking.isMarked) {
      status.isDirty = true;
      return true;
    }
    return false;
  }
}

async function deleteUnmarkedFile<T>(
  fileNode: MarkingFileDataMapNode<T>,
  storage: DataStorage,
  currentPath: readonly string[] = [],
): Promise<void> {
  if ((fileNode.data || fileNode.isDirty) && !fileNode.isMarked) {
    await storage.deleteAsync(currentPath);
  }
  if (fileNode.children) {
    for (const key of Object.keys(fileNode.children)) {
      await deleteUnmarkedFile(fileNode.children[key], storage, [...currentPath, key]);
    }
  }
}

abstract class MappingNodeBase {
  protected childConfigs: Array<MappingNode> = [];

  protected constructor(protected path: readonly string[]) {}

  public addChild(child: MappingNode) {
    this.childConfigs.push(child);
  }

  protected async saveChildrenAsync<T>(
    prevParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    for (const config of this.childConfigs) {
      parentModel = await config.saveAsync(
        prevParentNode,
        nextParentNode,
        parentModel,
        parentFilePath,
        reversePath,
        storageAccess,
      );
    }
    return parentModel;
  }

  protected makeChildrenStatusNode<T>(
    prevParentNode: MarkingFileDataMapNode<T>,
    parentStatusNode: WritableFileDataStatusMapNode,
    parentData: T,
    storageDataTrait: StorageDataTrait<T>,
  ): boolean {
    return this.childConfigs
      .map((config) => config.makeStatusNode(prevParentNode, parentStatusNode, parentData, storageDataTrait))
      .some(Boolean);
  }

  protected makeChildrenFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): boolean {
    return this.childConfigs.map((config) => config.makeFileDataMap(parentNode, parentModel, dataTrait)).some(Boolean);
  }

  protected remakeChildrenFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
    statusNode: FileDataStatusMapNode,
  ): boolean {
    return this.childConfigs
      .map((config) => config.remakeFileDataMap(parentNode, parentModel, dataTrait, statusNode))
      .some(Boolean);
  }

  protected async loadChildrenAsync<T>(
    rawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    for (const config of this.childConfigs) {
      parentModel = await config.loadAsync(rawData, parentModel, parentFileDataMap, parentFilePath, storageAccess);
    }
    return parentModel;
  }
}

interface StorageAccess<T> {
  readonly storage: DataStorage;
  readonly formatter: DataFormatter;
  readonly modelManager: StorageDataTrait<T>;
}

abstract class MappingNode extends MappingNodeBase {
  protected _directoryPath: readonly string[];

  /**
   *
   * @param path 保存対象のデータパス
   * @param directoryPath ファイルシステム上の親ノードからの相対パス
   */
  public constructor(path: readonly string[], directoryPath: readonly string[]) {
    super(path);
    this._directoryPath = directoryPath;
  }

  public abstract saveAsync<T>(
    prevParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T>;

  public abstract makeStatusNode<T>(
    prevParentNode: MarkingFileDataMapNode<T>,
    parentDirtyNode: WritableDirtyFileMapNode,
    parentData: T,
    storageDataTrait: StorageDataTrait<T>,
  ): boolean;

  public abstract loadAsync<T>(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T>;

  public abstract makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
  ): boolean;

  public abstract remakeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
    statusNode: FileDataStatusMapNode,
  ): boolean;
}

class MapMappingNode<T> extends MappingNode {
  public async saveAsync<T>(
    prevParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    const model = storageAccess.modelManager.getForPath(parentModel, this.path);
    if (model === undefined) {
      return parentModel;
    }
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const prevNodeForDirectory = prevParentNode && getNodeForFilePath(prevParentNode, this._directoryPath);
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    await storageAccess.modelManager.mapModelForEachAsync(model, async (childModel, key) => {
      const filename = key + '.yml';
      const filePath = [...this._directoryPath, filename];
      const prevChildNode = prevNodeForDirectory && getNodeForFilePath(prevNodeForDirectory, [filename]);
      const nextChildNode: WritableFileDataMapNode<T> = {children: {}};
      setModelForFilePath(nextNodeForDirectory, childModel, [filename], undefined);
      if (prevChildNode) {
        prevChildNode.isMarked = true;
      }
      const childModelForSave = await this.saveChildrenAsync(
        prevNodeForDirectory && getNodeForFilePath(prevNodeForDirectory, [key]),
        nextChildNode,
        childModel,
        [...baseFilePath, key],
        [key],
        storageAccess,
      );
      if (Object.keys(nextChildNode).length) {
        nextNodeForDirectory.children[key] = toMarkingFileDataMapNode(nextChildNode);
      }
      if (shouldSave(storageAccess.modelManager, prevChildNode, childModel)) {
        const raw = storageAccess.modelManager.convertBack(childModelForSave);
        await storageAccess.storage.saveAsync([...baseFilePath, filename], storageAccess.formatter.format(raw));
      }
      const filePathModel = storageAccess.modelManager.stringModel(filePath.join('/'));
      parentModel = storageAccess.modelManager.setForPath(parentModel, filePathModel, [...this.path, key]);
    });
    return parentModel;
  }

  makeStatusNode<T>(
    prevParentNode: MarkingFileDataMapNode<T>,
    parentStatusNode: WritableFileDataStatusMapNode,
    parentData: T,
    storageDataTrait: StorageDataTrait<T>,
  ): boolean {
    const model = storageDataTrait.getForPath(parentData, this.path);
    const prevNodeForDirectory = prevParentNode && getNodeForFilePath(prevParentNode, this._directoryPath);
    if (!prevNodeForDirectory) {
      return false;
    }
    let dirtyNodeForDirectory: WritableFileDataStatusMapNode | undefined;
    const getOrSetStatusNodeForDirectory = () =>
      dirtyNodeForDirectory ??
      (dirtyNodeForDirectory = getOrSetDefaultNodeForFilePath(parentStatusNode, this._directoryPath));
    let hasChildren = false;
    if (model !== undefined && prevNodeForDirectory.children) {
      storageDataTrait.mapModelForEach(model, (childModel, key) => {
        // TODO ここではないが。新しく追加されたデータがある状態でmakeFileDataMapすると、新しいファイルが存在するかのように見えてしまう。
        //      データ構造自体の修正が必要そう。(dirtyでなくても、元々保存されていたファイルのパスを示す何かが必要)
        //      => ファイルの削除はisMarkedでやってるんだし、ここもそれでやるか

        const prevChildrenNode = getNodeForFilePath(prevNodeForDirectory, [key]);
        if (prevChildrenNode) {
          const childDirtyNode: WritableFileDataStatusMapNode = {children: {}};
          if (this.makeChildrenStatusNode(prevChildrenNode, childDirtyNode, childModel, storageDataTrait)) {
            getOrSetStatusNodeForDirectory().children[key] = childDirtyNode;
            hasChildren = true;
          }
        }

        const filename = key + '.yml';
        const prevChildNode = getNodeForFilePath(prevNodeForDirectory, [filename]);
        if (shouldSave(storageDataTrait, prevChildNode, childModel)) {
          getOrSetStatusNodeForDirectory().children[filename] = {isDirty: true, children: {}};
        } else if (prevChildNode) {
          getOrSetStatusNodeForDirectory().children[filename] = {exists: true, children: {}};
        }
        if (prevChildNode) {
          prevChildNode.isMarked = true;
        }
        hasChildren = true;
      });
    }
    return hasChildren;
  }

  public makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
  ): boolean {
    const model = parentModel === undefined ? undefined : dataTrait.getForPath(parentModel, this.path);
    let hasChildren = false;
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
    if (model !== undefined) {
      dataTrait.mapModelForEach(model, (childModel, key) => {
        const filename = key + '.yml';
        setModelForFilePath(nextNodeForDirectory, childModel, [filename], undefined);
        const nextChildNode: WritableFileDataMapNode<T> = {children: {}};
        if (this.makeChildrenFileDataMap(nextChildNode, childModel, dataTrait)) {
          nextNodeForDirectory.children[key] = nextChildNode;
        }
        hasChildren = true;
      });
    }
    return hasChildren;
  }

  public remakeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
    statusNode: FileDataStatusMapNode,
  ): boolean {
    const statusNodeForDirectory = getNodeForFilePath(statusNode, this._directoryPath);
    if (!statusNodeForDirectory) {
      return false;
    }

    let hasChildren = false;
    const model = parentModel === undefined ? undefined : dataTrait.getForPath(parentModel, this.path);
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
    const statusChildKeys =
      statusNodeForDirectory.children && new Set<string>(Object.keys(statusNodeForDirectory.children));
    if (model !== undefined) {
      dataTrait.mapModelForEach(model, (childModel, key) => {
        const filename = key + '.yml';
        const childStatusNode = getNodeForFilePath(statusNodeForDirectory, [filename]);
        if (childStatusNode) {
          setModelForFilePath(nextNodeForDirectory, childModel, [filename], childStatusNode.isDirty);
          hasChildren = true;
        }

        const childrenStatusNode = getNodeForFilePath(statusNodeForDirectory, [key]);
        if (childrenStatusNode) {
          const nextChildNode: WritableFileDataMapNode<T> = {children: {}};
          if (this.remakeChildrenFileDataMap(nextChildNode, childModel, dataTrait, childrenStatusNode)) {
            nextNodeForDirectory.children[key] = toMarkingFileDataMapNode(nextChildNode);
            hasChildren = true;
          }
        }
        statusChildKeys?.delete(key);
        statusChildKeys?.delete(filename);
      });
    }

    if (statusChildKeys) {
      for (const key of statusChildKeys) {
        // この下にはすでにモデルが存在しないことが保証されるので、FileMapper無関係にStatusMapからFileMapを生成する。
        const childNode = remakeFileMapFromStatus<T>(statusNodeForDirectory.children[key]);
        if (childNode) {
          nextNodeForDirectory.children[key] = childNode;
          hasChildren = true;
        }
      }
    }
    return hasChildren;
  }

  public async loadAsync<T>(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    const data = getForPath(parentRawData, this.path);
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const nodeForDirectory = getOrSetDefaultNodeForFilePath(parentFileDataMap, this._directoryPath);
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        const filename = key + '.yml';
        const source = await storageAccess.storage.loadAsync([...baseFilePath, filename]);
        const parsed = storageAccess.formatter.parse(source);
        let childModel = storageAccess.modelManager.convert(parsed);
        const childNode: WritableFileDataMapNode<T> = {children: {}};
        childModel = await this.loadChildrenAsync(parsed, childModel, childNode, [...baseFilePath, key], storageAccess);
        setModelForFilePath(nodeForDirectory, childModel, [filename], undefined);
        if (Object.keys(childNode).length) {
          nodeForDirectory.children[key] = childNode;
        }
        parentModel = storageAccess.modelManager.setForPath(parentModel, childModel, [...this.path, key]);
      }
    }
    return parentModel;
  }
}

export class SingleMappingNode<T> extends MappingNode {
  private _fileName: string;

  /**
   *
   * @param path 保存対象のデータパス
   * @param directoryPath ファイルシステム上の親ノードからの相対パス
   * @param fileName
   */
  public constructor(path: readonly string[], directoryPath: Array<string>, fileName: string) {
    super(path, directoryPath);
    this._fileName = fileName;
  }

  public async saveAsync<T>(
    prevParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    const model = storageAccess.modelManager.getForPath(parentModel, this.path);
    if (model === undefined) {
      return parentModel;
    }
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const prevNodeForDirectory = prevParentNode && getNodeForFilePath(prevParentNode, this._directoryPath);
    const prevNode = prevNodeForDirectory && getNodeForFilePath(prevNodeForDirectory, [this._fileName]);
    const nextNode = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    setModelForFilePath(nextNode, model, [this._fileName], undefined);
    if (prevNode) {
      prevNode.isMarked = true;
    }
    const modelForSave = await this.saveChildrenAsync(
      prevNodeForDirectory,
      nextNode,
      model,
      baseFilePath,
      [],
      storageAccess,
    );
    if (shouldSave(storageAccess.modelManager, prevNode, model)) {
      const raw = storageAccess.modelManager.convertBack(modelForSave);
      await storageAccess.storage.saveAsync([...baseFilePath, this._fileName], storageAccess.formatter.format(raw));
    }
    const filePathModel = storageAccess.modelManager.stringModel(
      [...reversePath, ...this._directoryPath, this._fileName].join('/'),
    );
    parentModel = storageAccess.modelManager.setForPath(parentModel, filePathModel, this.path);
    return parentModel;
  }

  makeStatusNode<T>(
    prevParentNode: MarkingFileDataMapNode<T>,
    parentStatusNode: WritableFileDataStatusMapNode,
    parentData: T,
    storageDataTrait: StorageDataTrait<T>,
  ): boolean {
    const prevNodeForDirectory = getNodeForFilePath(prevParentNode, this._directoryPath);
    if (!prevNodeForDirectory) {
      return false;
    }
    const model = storageDataTrait.getForPath(parentData, this.path);
    const statusNodeForDirectory = getOrSetDefaultNodeForFilePath(parentStatusNode, this._directoryPath);

    this.makeChildrenStatusNode(prevNodeForDirectory, statusNodeForDirectory, model, storageDataTrait);

    const prevChildNode = getNodeForFilePath(prevNodeForDirectory, [this._fileName]);
    if (prevChildNode) {
      if (shouldSave(storageDataTrait, prevChildNode, model)) {
        statusNodeForDirectory.children[this._fileName] = {isDirty: true, children: {}};
      } else {
        statusNodeForDirectory.children[this._fileName] = {exists: true, children: {}};
      }
      prevChildNode.isMarked = true;
      return true;
    }
    return false;
  }

  public makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): boolean {
    const model = dataTrait.getForPath(parentModel, this.path);
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
    let hasChildren = false;
    if (model !== undefined) {
      setModelForFilePath(nextNodeForDirectory, model, [this._fileName], undefined);
      hasChildren = true;
    }
    return this.makeChildrenFileDataMap(nextNodeForDirectory, model, dataTrait) || hasChildren;
  }

  remakeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
    statusNode: FileDataStatusMapNode,
  ): boolean {
    const model = parentModel === undefined ? undefined : dataTrait.getForPath(parentModel, this.path);
    const childStatusNodeForDirectory = getNodeForFilePath(statusNode, this._directoryPath);
    if (!childStatusNodeForDirectory) {
      return false;
    }

    const childStatusNode = getNodeForFilePath(childStatusNodeForDirectory, [this._fileName]);
    if (model) {
      let hasChildren = false;
      const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
      if (childStatusNode) {
        setModelForFilePath(nextNodeForDirectory, model, [this._fileName], childStatusNode.isDirty);
        hasChildren = true;
      }
      return (
        this.remakeChildrenFileDataMap(nextNodeForDirectory, model, dataTrait, childStatusNodeForDirectory) ||
        hasChildren
      );
    } else {
      // この下にはすでにモデルが存在しないことが保証されるので、FileMapper無関係にStatusMapからFileMapを生成する。
      if (childStatusNode) {
        const childNode = remakeFileMapFromStatus<T>(childStatusNode);
        if (childNode) {
          const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
          nextNodeForDirectory.children[this._fileName] = childNode;
          return true;
        }
      }
      return false;
    }
  }

  public async loadAsync<T>(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T> {
    const nodeForDirectory = getOrSetDefaultNodeForFilePath(parentFileDataMap, this._directoryPath);
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    if (unknownIsObject(parentRawData)) {
      const source = await storageAccess.storage.loadAsync([...baseFilePath, this._fileName]);
      const parsed = storageAccess.formatter.parse(source);
      let childModel = storageAccess.modelManager.convert(parsed);
      const childNode = getOrSetDefaultNodeForFilePath(nodeForDirectory, [this._fileName]);
      childModel = await this.loadChildrenAsync(parsed, childModel, nodeForDirectory, baseFilePath, storageAccess);
      childNode.data = childModel;
      parentModel = storageAccess.modelManager.setForPath(parentModel, childModel, this.path);
    }
    return parentModel;
  }
}

export default class DataMapper extends MappingNodeBase {
  private indexFileName = 'index.yml';

  public static build(config: DataMapperConfig | undefined): DataMapper {
    const mapper = new DataMapper([]);
    if (config) {
      this._build(config.children || [], mapper);
    }
    return mapper;
  }

  private static _build(configs: Array<DataMapperNodeConfig>, parent: MappingNodeBase): void {
    configs.forEach((config: DataMapperNodeConfig) => {
      const path = config.path ? config.path.split('.') : [];
      const directory = config.directory === '' || !config.directory ? [] : config.directory.split('/');
      switch (config.type) {
        case 'single': {
          const singleNode = new SingleMappingNode(path, directory, config.fileName);
          this._build(config.children || [], singleNode);
          parent.addChild(singleNode);
          break;
        }

        case 'map': {
          const mapNode = new MapMappingNode(path, directory);
          this._build(config.children || [], mapNode);
          parent.addChild(mapNode);
          break;
        }

        default:
          throw new Error();
      }
    });
  }

  public async saveAsync<T>(
    originNode: FileDataMapNode<T>,
    // TODO T | undefined
    model: T,
    storage: DataStorage,
    storageDataTrait: StorageDataTrait<T>,
    formatter: DataFormatter = new YamlDataFormatter(),
  ): Promise<FileDataMapNode<T>> {
    const nextRoot: WritableFileDataMapNode<T> = {children: {}};
    const originalModel = model;
    const markingNode = toMarkingFileDataMapNode(originNode);
    const storageAccess = {storage, modelManager: storageDataTrait, formatter};
    model = await this.saveChildrenAsync(markingNode, nextRoot, model, [], [], storageAccess);
    if (shouldSave(storageDataTrait, originNode.children?.[this.indexFileName], originalModel)) {
      const raw = storageDataTrait.convertBack(model);
      await storage.saveAsync([this.indexFileName], formatter.format(raw));
      setModelForFilePath(nextRoot, originalModel, [this.indexFileName], undefined);
    }
    if (markingNode.children?.[this.indexFileName]) {
      markingNode.children[this.indexFileName].isMarked = true;
    }
    // console.log('---- markingNode@saveAsync', markedNodeToDebugString(markingNode));
    await deleteUnmarkedFile(markingNode, storage);
    return nextRoot;
  }

  public makeFileDataStatusMapNode<T>(
    prevNode: MarkingFileDataMapNode<T>,
    currentData: T,
    storageDataTrait: StorageDataTrait<T>,
  ): FileDataStatusMapNode {
    const nextNode: WritableFileDataStatusMapNode = {children: {}};
    const markingNode = toMarkingFileDataMapNode(prevNode);
    this.makeChildrenStatusNode(markingNode, nextNode, currentData, storageDataTrait);
    if (shouldSave(storageDataTrait, markingNode.children[this.indexFileName], currentData)) {
      nextNode.children[this.indexFileName] = {isDirty: true, children: {}};
    }
    if (markingNode.children[this.indexFileName]) {
      markingNode.children[this.indexFileName].isMarked = true;
    }
    // console.log('---- markingNode@makeFileDataStatusMapNode', markedNodeToDebugString(markingNode));
    setDirtyWithMarkingNode(nextNode, markingNode);
    return nextNode;
  }

  public makeFileDataMap<T>(dataModel: T, dataTrait: StorageDataTrait<T>): FileDataMapNode<T> {
    const rootNode: WritableFileDataMapNode<T> = {children: {}};
    this.makeChildrenFileDataMap(rootNode, dataModel, dataTrait);
    setModelForFilePath(rootNode, dataModel, [this.indexFileName], undefined);
    return rootNode;
  }

  public remakeFileDataMap<T>(
    dataModel: T | undefined,
    dataTrait: StorageDataTrait<T>,
    statusNode: FileDataStatusMapNode,
  ): FileDataMapNode<T> {
    const rootNode: WritableFileDataMapNode<T> = {children: {}};
    this.remakeChildrenFileDataMap(rootNode, dataModel, dataTrait, statusNode);
    const indexStatusNode = getNodeForFilePath(statusNode, [this.indexFileName]);
    setModelForFilePath(rootNode, dataModel, [this.indexFileName], indexStatusNode?.isDirty);
    return rootNode;
  }

  public async loadAsync<T>(
    storage: DataStorage,
    storageDataTrait: StorageDataTrait<T>,
    formatter: DataFormatter = new YamlDataFormatter(),
  ): Promise<{rootNode: FileDataMapNode<T>; model: T} | undefined> {
    // if (!(await storage.exists([this.indexFileName]))) {
    //   return undefined;
    // }
    const source = await storage.loadAsync([this.indexFileName]);
    const formatted = formatter.parse(source);
    let model = storageDataTrait.convert(formatted);
    const root: WritableFileDataMapNode<T> = {children: {}};
    const storageAccess = {storage, modelManager: storageDataTrait, formatter};
    model = await this.loadChildrenAsync(formatted, model, root, [], storageAccess);
    setModelForFilePath(root, model, [this.indexFileName], undefined);
    return {rootNode: root, model};
  }
}
