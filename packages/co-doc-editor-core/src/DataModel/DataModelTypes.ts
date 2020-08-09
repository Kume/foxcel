import {ForwardDataPath} from './DataPath';

export enum DataModelType {
  Null,
  Integer,
  Float,
  Boolean,
  String,
  Map,
  List,
}

export type DataModel =
  | NullDataModel
  | IntegerDataModel
  | FloatDataModel
  | BooleanDataModel
  | StringDataModel
  | MapDataModel
  | ListDataModel;

export type NullDataModel = null;

export type IntegerDataModel = number;

export type FloatDataModel = number;

export type BooleanDataModel = boolean;

export type StringDataModel = string;

export type ListDataModel = readonly DataModel[];

export interface MapDataModel {
  readonly t: DataModelType.Map;
  readonly v: ReadonlyArray<Readonly<[string | null, DataModel]>>;
}

export interface DataCollectionItem {
  index?: string | number;
  path: ForwardDataPath;
  data: DataModel;
}
