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

export type ListDataModel = readonly (readonly [number, DataModel])[];

export interface MapDataModel {
  readonly t: DataModelType.Map;
  readonly v: readonly MapDataModelItem[];
}

export type MapDataModelItem = readonly [string | null, number, DataModel];

export interface DataCollectionItem {
  index?: string | number;
  path: ForwardDataPath;
  data: DataModel;
}

export interface DataPointer {
  /**
   * index
   * 要素数に変化がない場合の高速検索のためのindex
   */
  readonly i: number;

  /**
   * id
   */
  readonly d: number;
}
