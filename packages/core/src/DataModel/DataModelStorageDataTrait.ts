import {StorageDataTrait} from '../Storage/StorageDataTrait';
import {DataModel, ListDataModel, MapDataModel} from './DataModelTypes';
import {
  dataModelEquals,
  dataModelIsMap,
  dataModelToJson,
  eachMapDataItem,
  getListDataAt,
  getMapItemAt,
  PathContainer,
  PathContainerMapChild,
  setToDataModel,
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

  listChild(list: ListDataModel): [model: DataModel, index: number] | undefined {
    const currentPathComponent = this.path[this.index];
    if (/^[0-9]+$/.test(currentPathComponent)) {
      const index = Number.parseInt(currentPathComponent);
      const data = getListDataAt(list, index);
      return data === undefined ? undefined : [data, index];
    }
    return undefined;
  }
  mapChild(map: MapDataModel): PathContainerMapChild {
    const currentPathComponent = this.path[this.index];
    const item = getMapItemAt(map, currentPathComponent);
    if (!item) {
      return [undefined, currentPathComponent, undefined];
    }
    const [data, , , index] = item;
    return [data, currentPathComponent, index];
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
