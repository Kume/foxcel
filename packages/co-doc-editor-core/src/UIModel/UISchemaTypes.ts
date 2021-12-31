import {
  BooleanDataSchema,
  ConditionalDataSchema,
  DataSchema,
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
  readonly key?: UISchemaKey;
}

export type FlattenableUISchemaCommon =
  | {keyFlatten: true; flatKeys: ReadonlyMap<UISchemaKey, readonly UISchemaKey[]>}
  | {keyFlatten?: false};

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
  | ConditionalUISchema
  | RecursiveUISchema;

export interface MappingTableUISchema extends UISchemaBase {
  readonly type: 'mappingTable';
  readonly keyFlatten?: undefined;
  readonly dataSchema: MapDataSchema;
  readonly sourcePath: DataPath;
  readonly contents: ReadonlyArray<UISchema>;
}

export interface TextUISchema extends UISchemaBase {
  readonly type: 'text';
  readonly keyFlatten?: undefined;
  readonly dataSchema: StringDataSchema | KeyDataSchema;
}

export type TabUISchema = {
  readonly type: 'tab';
  readonly dataSchema: FixedMapDataSchema;
  readonly contents: ReadonlyArray<UISchema>;
} & UISchemaBase &
  FlattenableUISchemaCommon;

export interface TableUISchema extends UISchemaBase {
  readonly type: 'table';
  readonly keyFlatten?: undefined;
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly contents: ReadonlyArray<UISchema>;
}

export type SelectUISchema = SingleSelectUISchema | MultiSelectUISchema;

interface SelectUISchemaBase extends UISchemaBase {
  readonly type: 'select';
  readonly keyFlatten?: undefined;
  readonly options: readonly SelectOptionSchema<string | number>[];
}

interface SingleSelectUISchema extends SelectUISchemaBase {
  readonly dataSchema: StringDataSchema;
  readonly isMulti: false;
}

interface MultiSelectUISchema extends SelectUISchemaBase {
  readonly dataSchema: ListDataSchema;
  readonly isMulti: true;
}

export interface NumberUISchema extends UISchemaBase {
  readonly type: 'number';
  readonly keyFlatten?: undefined;
  readonly dataSchema: NumberDataSchema;
}

export type FormUISchema = {
  readonly type: 'form';
  readonly dataSchema: FixedMapDataSchema;
  readonly contents: ReadonlyArray<UISchema>;
} & UISchemaBase &
  FlattenableUISchemaCommon;

export interface ContentListUISchema extends UISchemaBase {
  readonly type: 'contentList';
  readonly keyFlatten?: undefined;
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly content: UISchema;
}

export interface CheckBoxUISchema extends UISchemaBase {
  readonly type: 'checkbox';
  readonly keyFlatten?: undefined;
  readonly dataSchema: BooleanDataSchema;
}

export interface ConditionalUISchema extends UISchemaBase {
  readonly type: 'conditional';
  readonly keyFlatten?: undefined;
  readonly dataSchema: ConditionalDataSchema;
  readonly contents: {readonly [key: string]: UISchema};
}

export interface ReferenceUISchema {
  readonly type: 'reference';
  readonly ref: string;
  readonly namespaceRef?: string;
  readonly namespace: readonly string[];
}

export interface RecursiveUISchema {
  readonly type: 'recursive';
  readonly dataSchema: DataSchema;
  readonly depth: number;
}
