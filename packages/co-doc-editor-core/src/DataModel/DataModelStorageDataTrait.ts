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
    console.log('xxxx', {destination, model, path});
    const result = setToDataModel(stringArrayToDataPath(path), model, destination, undefined);
    return result ?? destination;
  },

  async mapModelForEach(model: DataModel, callback: (value: DataModel, key: string) => Promise<void>): Promise<void> {
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
