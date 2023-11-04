import {StorageDataTrait} from '../Storage/StorageDataTrait';
import {DataModel} from './DataModelTypes';
import {
  dataModelEquals,
  dataModelIsMap,
  dataModelToJson,
  eachMapDataItem,
  setToDataModel,
  stringToDataModel,
  unknownToDataModel,
} from './DataModel';
import {getDataModelByForwardPath} from './DataModelCollector';
import {stringArrayToDataPath} from './DataPath';
import {DataSchemaContext} from './DataSchema';

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
      stringArrayToDataPath(path),
      model,
      destination,
      DataSchemaContext.createRootContext(undefined),
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
