import {
  DataSchemaExcludeRecursive,
  DataSchemaType,
  FixedMapDataSchema,
  ListDataSchema,
  MapDataSchema,
} from './DataSchema';
import {DataModel, ListDataModel, MapDataModel} from './DataModelTypes';
import {
  booleanToDataModel,
  emptyListModel,
  emptyMapModel,
  nullDataModel,
  numberToIntegerDataModel,
  stringToDataModel,
  unknownToDataModel,
} from './DataModel';

export function defaultDataModelForSchema(schema: FixedMapDataSchema): MapDataModel;
export function defaultDataModelForSchema(schema: MapDataSchema): MapDataModel;
export function defaultDataModelForSchema(schema: ListDataSchema): ListDataModel;
export function defaultDataModelForSchema(schema: DataSchemaExcludeRecursive): DataModel;
export function defaultDataModelForSchema(schema: DataSchemaExcludeRecursive): DataModel {
  // TODO nullableの場合nullをデフォルト値に
  switch (schema.t) {
    case DataSchemaType.Number:
      return schema.default === undefined ? 0 : numberToIntegerDataModel(schema.default);
    case DataSchemaType.Boolean:
      return schema.default === undefined ? false : booleanToDataModel(schema.default);
    case DataSchemaType.String:
      return schema.default === undefined ? '' : stringToDataModel(schema.default);
    case DataSchemaType.Map:
    case DataSchemaType.FixedMap:
      return schema.default === undefined ? emptyMapModel : unknownToDataModel(schema.default);
    case DataSchemaType.List:
      return schema.default === undefined ? emptyListModel : unknownToDataModel(schema.default);
    case DataSchemaType.Conditional:
      return nullDataModel; // TODO ここで解決はできない気がする
    case DataSchemaType.Key:
      return nullDataModel; // TODO 何を返すべきかわからない
  }
}
