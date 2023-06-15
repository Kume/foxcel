import DataStorage from './DataStorage';
import {DataFormatter} from './DataFormatter';
import YamlDataFormatter from './YamlDataFormatter';
import {StorageDataTrait} from './StorageDataTrait';
import {getForPath, unknownIsObject} from './StorageCommon';
import {DataMapperConfig, DataMapperNodeConfig} from '..';

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
  readonly isDirty?: boolean;
  readonly children?: {readonly [key: string]: FileDataMapNode<T>};
};

export interface DirtyFileMapNode {
  readonly isDirty?: boolean;
  readonly children?: Record<string, DirtyFileMapNode>;
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
  children?: {[key: string]: WritableFileDataMapNode<T>};
};

type MarkingFileDataMapNode<T> = {
  data?: T;
  isDirty?: boolean;
  children?: {[key: string]: MarkingFileDataMapNode<T>};
  isMarked?: true;
};

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
  node: WritableFileDataMapNode<T>,
  path: readonly string[],
): WritableFileDataMapNode<T> {
  if (path.length === 0) {
    return node;
  }
  const [firstPathComponent, ...childPath] = path;
  if (!node.children) {
    node.children = {};
  }
  const childNode = node.children[firstPathComponent] ?? (node.children[firstPathComponent] = {});
  return getOrSetDefaultNodeForFilePath(childNode, childPath);
}

function setModelForFilePath<T>(
  destination: WritableFileDataMapNode<T>,
  data: T | undefined,
  path: readonly string[],
): WritableFileDataMapNode<T> | undefined {
  switch (path.length) {
    case 0:
      return destination;
    case 1:
      if (unknownIsObject(destination)) {
        if (destination.children?.[path[0]]) {
          destination.children[path[0]].data = data;
          return destination.children[path[0]];
        } else {
          const childNode = {data};
          if (!destination.children) {
            destination.children = {};
          }
          destination.children[path[0]] = {data};
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
          destination.children[firstPathComponent] = {};
        }
        return setModelForFilePath(destination.children[firstPathComponent], data, childPath);
      }
      return undefined;
  }
}

function toMarkingFileDataMapNode<T>(origin: FileDataMapNode<T>): MarkingFileDataMapNode<T> {
  let children: {[key: string]: MarkingFileDataMapNode<T>} | undefined;
  if (origin.children) {
    children = {};
    for (const key of Object.keys(origin.children)) {
      children[key] = toMarkingFileDataMapNode(origin.children[key]);
    }
  }
  return {data: origin.data, isDirty: origin.isDirty, children};
}

async function deleteUnmarkedFile<T>(
  fileNode: MarkingFileDataMapNode<T>,
  storage: DataStorage,
  currentPath: readonly string[] = [],
): Promise<void> {
  if (fileNode.data && !fileNode.isMarked) {
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

  protected makeChildrenFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): void {
    for (const config of this.childConfigs) {
      config.makeFileDataMap(parentNode, parentModel, dataTrait);
    }
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

  public abstract loadAsync<T>(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
    storageAccess: StorageAccess<T>,
  ): Promise<T>;

  public abstract makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): void;
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
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    await storageAccess.modelManager.mapModelForEachAsync(model, async (childModel, key) => {
      const filename = key + '.yml';
      const filePath = [...this._directoryPath, filename];
      const prevChildNode = prevParentNode && getNodeForFilePath(prevParentNode, filePath);
      const nextChildNode: WritableFileDataMapNode<T> = {};
      setModelForFilePath(nextNodeForDirectory, childModel, [filename]);
      if (prevChildNode) {
        prevChildNode.isMarked = true;
      }
      if (!(prevChildNode?.data && storageAccess.modelManager.modelEquals(prevChildNode.data, childModel))) {
        childModel = await this.saveChildrenAsync(
          prevChildNode,
          nextChildNode,
          childModel,
          [...baseFilePath, key],
          [key],
          storageAccess,
        );
        const raw = storageAccess.modelManager.convertBack(childModel);
        await storageAccess.storage.saveAsync([...baseFilePath, filename], storageAccess.formatter.format(raw));
        if (Object.keys(nextChildNode).length) {
          nextNodeForDirectory.children![key] = toMarkingFileDataMapNode(nextChildNode);
        }
      }
      const filePathModel = storageAccess.modelManager.stringModel(filePath.join('/'));
      parentModel = storageAccess.modelManager.setForPath(parentModel, filePathModel, [...this.path, key]);
    });
    return parentModel;
  }

  public makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): void {
    const model = dataTrait.getForPath(parentModel, this.path);
    if (model === undefined) {
      return;
    }
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(parentNode, this._directoryPath);
    void dataTrait.mapModelForEach(model, (childModel, key) => {
      const filename = key + '.yml';
      setModelForFilePath(nextNodeForDirectory, childModel, [filename]);
      const nextChildNode: WritableFileDataMapNode<T> = {};
      this.makeChildrenFileDataMap(nextChildNode, childModel, dataTrait);
      if (Object.keys(nextChildNode).length) {
        nextNodeForDirectory.children![key] = toMarkingFileDataMapNode(nextChildNode);
      }
    });
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
        const childNode: WritableFileDataMapNode<T> = {};
        childModel = await this.loadChildrenAsync(parsed, childModel, childNode, [...baseFilePath, key], storageAccess);
        setModelForFilePath(nodeForDirectory, childModel, [filename]);
        if (Object.keys(childNode).length) {
          nodeForDirectory.children![key] = childNode;
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
    let model = storageAccess.modelManager.getForPath(parentModel, this.path);
    if (model === undefined) {
      return parentModel;
    }
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const prevNode = prevParentNode && getNodeForFilePath(prevParentNode, this._directoryPath);
    const nextNode = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    setModelForFilePath(nextNode, model, [this._fileName]);
    if (prevNode) {
      prevNode.isMarked = true;
    }
    if (!(prevNode?.data && storageAccess.modelManager.modelEquals(prevNode.data, model))) {
      model = await this.saveChildrenAsync(prevNode, nextNode, model, baseFilePath, [], storageAccess);
      const raw = storageAccess.modelManager.convertBack(model);
      await storageAccess.storage.saveAsync([...baseFilePath, this._fileName], storageAccess.formatter.format(raw));
    }
    const filePathModel = storageAccess.modelManager.stringModel(
      [...reversePath, ...this._directoryPath, this._fileName].join('/'),
    );
    parentModel = storageAccess.modelManager.setForPath(parentModel, filePathModel, this.path);
    return parentModel;
  }

  public makeFileDataMap<T>(
    parentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    dataTrait: StorageDataTrait<T>,
  ): void {
    const model = dataTrait.getForPath(parentModel, this.path);
    if (model === undefined) {
      return;
    }
    const nextNode = getOrSetDefaultNodeForFilePath(parentModel, this._directoryPath);
    setModelForFilePath(nextNode, model, [this._fileName]);
    this.makeChildrenFileDataMap(nextNode, model, dataTrait);
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
    const nextRoot: WritableFileDataMapNode<T> = {};
    const originalModel = model;
    const markingNode = toMarkingFileDataMapNode(originNode);
    const storageAccess = {storage, modelManager: storageDataTrait, formatter};
    model = await this.saveChildrenAsync(markingNode, nextRoot, model, [], [], storageAccess);
    const raw = storageDataTrait.convertBack(model);
    const rootNodeModel = originNode.children?.[this.indexFileName]?.data;
    if (
      rootNodeModel !== undefined &&
      (originNode?.isDirty || !storageDataTrait.modelEquals(rootNodeModel, originalModel))
    ) {
      await storage.saveAsync([this.indexFileName], formatter.format(raw));
      setModelForFilePath(nextRoot, originalModel, [this.indexFileName]);
    }
    if (markingNode.children?.[this.indexFileName]) {
      markingNode.children[this.indexFileName].isMarked = true;
    }
    await deleteUnmarkedFile(markingNode, storage);
    return nextRoot;
  }

  public makeFileDataMap<T>(dataModel: T, dataTrait: StorageDataTrait<T>): FileDataMapNode<T> {
    const rootNode: WritableFileDataMapNode<T> = {};
    this.makeChildrenFileDataMap(rootNode, dataModel, dataTrait);
    setModelForFilePath(rootNode, dataModel, [this.indexFileName]);
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
    const root: WritableFileDataMapNode<T> = {};
    const storageAccess = {storage, modelManager: storageDataTrait, formatter};
    model = await this.loadChildrenAsync(formatted, model, root, [], storageAccess);
    setModelForFilePath(root, model, [this.indexFileName]);
    return {rootNode: root, model};
  }
}
