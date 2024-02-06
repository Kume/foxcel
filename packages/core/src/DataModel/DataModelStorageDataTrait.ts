import {StorageDataTrait} from '../Storage/StorageDataTrait';
import {DataModel, ListDataModel, MapDataModel} from './DataModelTypes';
import {
  dataModelEquals,
  dataModelIsMap,
  dataModelToJson,
  eachMapDataItem,
  PathContainer,
  PathContainerMapChild,
  setToDataModel,
  SimplePathContainer,
  stringToDataModel,
  unknownToDataModel,
} from './DataModel';
import {getDataModelByForwardPath} from './DataModelCollector';
import {stringArrayToDataPath} from './DataPath';
import {DataModelContext} from './DataModelContext';

class StringPathContainer implements PathContainer {
  public static createRoot(path: readonly string[]): StringPathContainer | undefined {
    return path.length === 0 ? undefined : new StringPathContainer(path, 0);
  }

  public constructor(private readonly path: readonly string[], private readonly index: number) {}

  public get isLast(): boolean {
    return this.path.length - 1 === this.index;
  }

  next(): PathContainer | undefined {
    return this.isLast ? undefined : new StringPathContainer(this.path, this.index + 1);
  }

  public nextForListIndex(list: ListDataModel | undefined, index: number): PathContainer | undefined {
    return this.currentListIndex() === index ? this.next() : this;
  }

  public nextForMapKey(map: MapDataModel | undefined, key: string): PathContainer | undefined {
    const child = this.mapChild(map);
    return key === child?.[1] ? this.next() : this;
  }

  private currentListIndex(): number | undefined {
    const currentPathComponent = this.path[this.index];
    return /^[0-9]+$/.test(currentPathComponent) ? Number.parseInt(currentPathComponent) : undefined;
  }

  listChild(list: DataModel | undefined): [model: DataModel, index: number] | undefined {
    const index = this.currentListIndex();
    return index === undefined ? undefined : SimplePathContainer.listChildForIndex(list, index);
  }

  mapChild(map: DataModel | undefined): PathContainerMapChild {
    return SimplePathContainer.mapChildForKey(map, this.path[this.index]);
  }
}

export const dataModelStorageDataTrait: StorageDataTrait<DataModel> = {
  convert(source: unknown): DataModel {
    return unknownToDataModel(source);
  },

  convertBack(model: DataModel): unknown {
    return dataModelToJson(model);
  },

  getForPath(model: DataModel, path: readonly string[]): DataModel | undefined {
    return getDataModelByForwardPath(model, stringArrayToDataPath(path));
  },

  setForPath(destination: DataModel, model: DataModel, path: readonly string[]): DataModel {
    const result = setToDataModel(
      destination,
      StringPathContainer.createRoot(path),
      DataModelContext.createRoot({model: destination, schema: undefined}),
      {model},
    );
    return result ?? destination;
  },

  mapModelForEach(model: DataModel, callback: (value: DataModel, key: string) => void): void {
    if (dataModelIsMap(model)) {
      for (const [item, , key] of eachMapDataItem(model)) {
        if (key !== null) {
          callback(item, key);
        }
      }
    }
  },

  async mapModelForEachAsync(
    model: DataModel,
    callback: (value: DataModel, key: string) => Promise<void>,
  ): Promise<void> {
    if (dataModelIsMap(model)) {
      for (const [item, , key] of eachMapDataItem(model)) {
        if (key !== null) {
          await callback(item, key);
        }
      }
    }
  },

  modelEquals: dataModelEquals,
  stringModel: stringToDataModel,
};
