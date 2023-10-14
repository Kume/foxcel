import {
  BooleanDataSchema,
  ConditionalDataSchema,
  FixedMapDataSchema,
  KeyDataSchema,
  ListDataSchema,
  MapDataSchema,
  NumberDataSchema,
  SelectOptionSchema,
  StringDataSchema,
} from '../DataModel/DataSchema';
import {DataPath} from '../DataModel/DataPath';
import type {UISchemaKey} from './UISchema';

interface UISchemaBase {
  readonly label?: string;
}

export type FlattenableUISchemaCommon =
  | {keyFlatten: true; flatKeys: ReadonlyMap<UISchemaKey, readonly UISchemaKey[]>}
  | {keyFlatten?: false};

export type UISchemaOrRecursive = UISchema | RecursiveUISchema;

export type UISchema =
  | MappingTableUISchema
  | CheckBoxUISchema
  | ContentListUISchema
  | FormUISchema
  | NumberUISchema
  | SelectUISchema
  | TableUISchema
  | TabUISchema
  | TextUISchema
  | ConditionalUISchema;

export interface MappingTableUISchema extends UISchemaBase {
  readonly type: 'mappingTable';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: MapDataSchema;
  readonly sourcePath: DataPath;
  readonly contents: ReadonlyArray<UISchemaOrRecursive>;
}

export interface TextUISchema extends UISchemaBase {
  readonly type: 'text';
  readonly key?: UISchemaKey;
  readonly keyFlatten?: undefined;
  readonly dataSchema: StringDataSchema | KeyDataSchema;
  readonly multiline: boolean | undefined;
}

export type TabUISchema = {
  readonly type: 'tab';
  readonly key?: UISchemaKey;
  readonly dataSchema: FixedMapDataSchema;
  readonly contents: ReadonlyArray<UISchemaOrRecursive>;
} & UISchemaBase &
  FlattenableUISchemaCommon;

export interface TableUISchema extends UISchemaBase {
  readonly type: 'table';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly contents: ReadonlyArray<UISchemaOrRecursive>;
}

export type SelectUISchema = SingleSelectUISchema | MultiSelectUISchema;

interface SelectUISchemaBase extends UISchemaBase {
  readonly type: 'select';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly options: readonly SelectOptionSchema<string | number>[];
}

interface SingleSelectUISchema extends SelectUISchemaBase {
  readonly dataSchema: StringDataSchema | NumberDataSchema;
  readonly isMulti: false;
}

interface MultiSelectUISchema extends SelectUISchemaBase {
  readonly dataSchema: ListDataSchema;
  readonly isMulti: true;
}

export interface NumberUISchema extends UISchemaBase {
  readonly type: 'number';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: NumberDataSchema;
}

export type FormUISchema = {
  readonly type: 'form';
  readonly key?: UISchemaKey;
  readonly dataSchema: FixedMapDataSchema;
  readonly contents: ReadonlyArray<UISchemaOrRecursive>;
} & UISchemaBase &
  FlattenableUISchemaCommon;

export interface ContentListUISchema extends UISchemaBase {
  readonly type: 'contentList';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly content: UISchemaOrRecursive;
}

export interface CheckBoxUISchema extends UISchemaBase {
  readonly type: 'checkbox';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: BooleanDataSchema;
}

export interface ConditionalUISchema extends UISchemaBase {
  readonly type: 'conditional';
  readonly key?: string;
  readonly keyFlatten?: undefined;
  readonly dataSchema: ConditionalDataSchema;
  readonly contents: {readonly [key: string]: UISchemaOrRecursive};
}

export interface RecursiveUISchema {
  readonly type: 'recursive';
  readonly depth: number;

  readonly key?: string;
  /**
   * 参照先のUISchemaに定義されているDataSchemaを使うべきなのでRecursiveだけdataSchemaを定義しないが、
   * optionalChaining中にアクセスする場合に型定義だけあった方が便利なのでnever型で明示的にプロパティの存在を定義。
   */
  readonly dataSchema?: never;
}
