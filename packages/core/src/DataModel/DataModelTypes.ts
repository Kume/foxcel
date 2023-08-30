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

export type PublicListDataItem = readonly [data: DataModel, pointer: DataPointer, index: number];

export interface ListDataModel {
  readonly t: DataModelType.List;

  /** Max id */
  readonly m: number;

  /** Values */
  readonly v: readonly (readonly [id: number, data: DataModel])[];
}

export interface MapDataModel {
  readonly t: DataModelType.Map;

  /** Max id */
  readonly m: number;

  /** Key and values */
  readonly v: readonly MapDataModelItem[];
}

export type PublicMapDataItem = readonly [data: DataModel, pointer: DataPointer, key: string | null, index: number];

export type MapDataModelItem = readonly [key: string | null, id: number, data: DataModel];
export type MapDataModelItemWithNonNullableKey = readonly [key: string, id: number, data: DataModel];

export interface DataCollectionItem {
  key?: string;
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
