import DataStorage from './DataStorage';
import {DataFormatter} from './DataFormatter';
import YamlDataFormatter from './YamlDataFormatter';
import {StorageDataTrait} from './StorageDataTrait';
import {getForPath, unknownIsObject} from './StorageCommon';
import {DataMapperConfig, DataMapperNodeConfig} from '..';

export type FileDataMapNode<T> = {
  readonly data?: T;
  readonly children?: {readonly [key: string]: FileDataMapNode<T>};
};

type WritableFileDataMapNode<T> = {
  data?: T;
  children?: {[key: string]: WritableFileDataMapNode<T>};
};

type MarkingFileDataMapNode<T> = {
  data?: T;
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
  const marking: MarkingFileDataMapNode<T> = {};
  if (origin.data) {
    marking.data = origin.data;
  }
  if (origin.children) {
    const children: {[key: string]: MarkingFileDataMapNode<T>} = {};
    for (const key of Object.keys(origin.children)) {
      children[key] = toMarkingFileDataMapNode(origin.children[key]);
    }
    marking.children = children;
  }
  return marking;
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

abstract class MappingNodeBase<T> {
  protected storage: DataStorage;
  protected formatter: DataFormatter;
  protected modelManager: StorageDataTrait<T>;
  protected path: readonly string[];
  protected childConfigs: Array<MappingNode<T>> = [];

  protected constructor(
    storage: DataStorage,
    modelConverter: StorageDataTrait<T>,
    formatter: DataFormatter,
    path: readonly string[],
  ) {
    this.storage = storage;
    this.modelManager = modelConverter;
    this.formatter = formatter;
    this.path = path;
  }

  public addChild(child: MappingNode<T>) {
    this.childConfigs.push(child);
  }

  protected async saveChildrenAsync(
    originalParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
  ): Promise<T> {
    for (const config of this.childConfigs) {
      parentModel = await config.saveAsync(
        originalParentNode,
        nextParentNode,
        parentModel,
        parentFilePath,
        reversePath,
      );
    }
    return parentModel;
  }

  protected async loadChildrenAsync(
    rawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
  ): Promise<T> {
    for (const config of this.childConfigs) {
      parentModel = await config.loadAsync(rawData, parentModel, parentFileDataMap, parentFilePath);
    }
    return parentModel;
  }
}

abstract class MappingNode<T> extends MappingNodeBase<T> {
  protected _directoryPath: readonly string[];

  public constructor(
    storage: DataStorage,
    modelConverter: StorageDataTrait<T>,
    formatter: DataFormatter,
    path: readonly string[],
    directoryPath: readonly string[],
  ) {
    super(storage, modelConverter, formatter, path);
    this._directoryPath = directoryPath;
  }

  public abstract saveAsync(
    originalParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
  ): Promise<T>;

  public abstract loadAsync(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
  ): Promise<T>;
}

class MapMappingNode<T> extends MappingNode<T> {
  public async saveAsync(
    originalParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
  ): Promise<T> {
    const model = this.modelManager.getForPath(parentModel, this.path);
    if (!model) {
      return parentModel;
    }
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const nextNodeForDirectory = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    await this.modelManager.mapModelForEach(model, async (childModel, key) => {
      const filename = key + '.yml';
      const filePath = [...this._directoryPath, filename];
      const originalChildNode = originalParentNode && getNodeForFilePath(originalParentNode, filePath);
      let nextChildNode: WritableFileDataMapNode<T> = {};
      setModelForFilePath(nextNodeForDirectory, childModel, [filename]);
      if (originalChildNode) {
        originalChildNode.isMarked = true;
      }
      if (originalChildNode?.data && this.modelManager.modelEquals(originalChildNode.data, childModel)) {
        nextChildNode = originalChildNode;
      } else {
        childModel = await this.saveChildrenAsync(
          originalChildNode,
          nextChildNode,
          childModel,
          [...baseFilePath, key],
          [key],
        );
        const raw = this.modelManager.convertBack(childModel);
        await this.storage.saveAsync([...baseFilePath, filename], this.formatter.format(raw));
        if (Object.keys(nextChildNode).length) {
          nextNodeForDirectory.children![key] = toMarkingFileDataMapNode(nextChildNode);
        }
      }
      const filePathModel = this.modelManager.stringModel(filePath.join('/'));
      parentModel = this.modelManager.setForPath(parentModel, filePathModel, [...this.path, key]);
    });
    return parentModel;
  }

  public async loadAsync(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
  ): Promise<T> {
    const data = getForPath(parentRawData, this.path);
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const nodeForDirectory = getOrSetDefaultNodeForFilePath(parentFileDataMap, this._directoryPath);
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        const filename = key + '.yml';
        const source = await this.storage.loadAsync([...baseFilePath, filename]);
        const parsed = this.formatter.parse(source);
        let childModel = this.modelManager.convert(parsed);
        const childNode: WritableFileDataMapNode<T> = {};
        childModel = await this.loadChildrenAsync(parsed, childModel, childNode, [...baseFilePath, key]);
        setModelForFilePath(nodeForDirectory, childModel, [filename]);
        if (Object.keys(childNode).length) {
          nodeForDirectory.children![key] = childNode;
        }
        parentModel = this.modelManager.setForPath(parentModel, childModel, [...this.path, key]);
      }
    }
    return parentModel;
  }
}

export class SingleMappingNode<T> extends MappingNode<T> {
  private _fileName: string;

  public constructor(
    storage: DataStorage,
    modelConverter: StorageDataTrait<T>,
    formatter: DataFormatter,
    path: readonly string[],
    directoryPath: Array<string>,
    fileName: string,
  ) {
    super(storage, modelConverter, formatter, path, directoryPath);
    this._fileName = fileName;
  }

  public async saveAsync(
    originalParentNode: MarkingFileDataMapNode<T> | undefined,
    nextParentNode: WritableFileDataMapNode<T>,
    parentModel: T,
    parentFilePath: readonly string[],
    reversePath: readonly string[],
  ): Promise<T> {
    let model = this.modelManager.getForPath(parentModel, this.path);
    if (!model) {
      return parentModel;
    }
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    const originalNode = originalParentNode && getNodeForFilePath(originalParentNode, this._directoryPath);
    let nextNode = getOrSetDefaultNodeForFilePath(nextParentNode, this._directoryPath);
    setModelForFilePath(nextNode, model, [this._fileName]);
    if (originalNode) {
      originalNode.isMarked = true;
    }
    if (originalNode?.data && this.modelManager.modelEquals(originalNode.data, model)) {
      nextNode = toMarkingFileDataMapNode(originalNode);
    } else {
      model = await this.saveChildrenAsync(originalNode, nextNode, model, baseFilePath, []);
      const raw = this.modelManager.convertBack(model);
      await this.storage.saveAsync([...baseFilePath, this._fileName], this.formatter.format(raw));
    }
    const filePathModel = this.modelManager.stringModel(
      [...reversePath, ...this._directoryPath, this._fileName].join('/'),
    );
    parentModel = this.modelManager.setForPath(parentModel, filePathModel, this.path);
    return parentModel;
  }

  public async loadAsync(
    parentRawData: unknown,
    parentModel: T,
    parentFileDataMap: WritableFileDataMapNode<T>,
    parentFilePath: readonly string[],
  ): Promise<T> {
    const nodeForDirectory = getOrSetDefaultNodeForFilePath(parentFileDataMap, this._directoryPath);
    const baseFilePath = [...parentFilePath, ...this._directoryPath];
    if (unknownIsObject(parentRawData)) {
      const source = await this.storage.loadAsync([...baseFilePath, this._fileName]);
      const parsed = this.formatter.parse(source);
      let childModel = this.modelManager.convert(parsed);
      const childNode = getOrSetDefaultNodeForFilePath(nodeForDirectory, [this._fileName]);
      childModel = await this.loadChildrenAsync(parsed, childModel, nodeForDirectory, baseFilePath);
      childNode.data = childModel;
      parentModel = this.modelManager.setForPath(parentModel, childModel, this.path);
    }
    return parentModel;
  }
}

export default class DataMapper<T> extends MappingNodeBase<T> {
  private indexFileName = 'index.yml';

  public static build<T>(
    config: DataMapperConfig | undefined,
    storage: DataStorage,
    storageDataTrait: StorageDataTrait<T>,
    formatter: DataFormatter = new YamlDataFormatter(),
  ): DataMapper<T> {
    const mapper = new DataMapper(storage, storageDataTrait, formatter, []);
    if (config) {
      this._build(storage, storageDataTrait, formatter, config.children || [], mapper);
    }
    return mapper;
  }

  private static _build<T>(
    storage: DataStorage,
    modelConverter: StorageDataTrait<T>,
    formatter: DataFormatter,
    configs: Array<DataMapperNodeConfig>,
    parent: MappingNodeBase<T>,
  ): void {
    configs.forEach((config: DataMapperNodeConfig) => {
      const path = config.path ? config.path.split('.') : [];
      const directory = config.directory === '' || !config.directory ? [] : config.directory.split('/');
      switch (config.type) {
        case 'single': {
          const singleNode = new SingleMappingNode(
            storage,
            modelConverter,
            formatter,
            path,
            directory,
            config.fileName,
          );
          this._build(storage, modelConverter, formatter, config.children || [], singleNode);
          parent.addChild(singleNode);
          break;
        }

        case 'map': {
          const mapNode = new MapMappingNode(storage, modelConverter, formatter, path, directory);
          this._build(storage, modelConverter, formatter, config.children || [], mapNode);
          parent.addChild(mapNode);
          break;
        }

        default:
          throw new Error();
      }
    });
  }

  public async saveAsync(originNode: FileDataMapNode<T>, model: T): Promise<FileDataMapNode<T>> {
    const nextRoot: WritableFileDataMapNode<T> = {};
    const originalModel = model;
    const markingNode = toMarkingFileDataMapNode(originNode);
    model = await this.saveChildrenAsync(markingNode, nextRoot, model, [], []);
    const raw = this.modelManager.convertBack(model);
    await this.storage.saveAsync([this.indexFileName], this.formatter.format(raw));
    setModelForFilePath(nextRoot, originalModel, [this.indexFileName]);
    if (markingNode.children?.[this.indexFileName]) {
      markingNode.children[this.indexFileName].isMarked = true;
    }
    await deleteUnmarkedFile(markingNode, this.storage);
    return nextRoot;
  }

  public async loadAsync(): Promise<{rootNode: FileDataMapNode<T>; model: T} | undefined> {
    if (!(await this.storage.exists([this.indexFileName]))) {
      return undefined;
    }
    const source = await this.storage.loadAsync([this.indexFileName]);
    const formatted = this.formatter.parse(source);
    let model = this.modelManager.convert(formatted);
    const root: WritableFileDataMapNode<T> = {};
    model = await this.loadChildrenAsync(formatted, model, root, []);
    setModelForFilePath(root, model, [this.indexFileName]);
    return {rootNode: root, model};
  }
}
