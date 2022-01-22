export type RootSchemaConfig = {
  readonly namedDataSchema?: SubDataSchemaConfig;
  readonly dataSchema: DataSchemaConfig;
  readonly namedUiSchema?: SubUISchemaConfig;
  readonly fileMap: DataMapperConfig;
} & UISchemaConfigHolder;

type UISchemaConfigHolder = {readonly uiRoot: UISchemaConfig /* old schema */} | {readonly uiSchema: UISchemaConfig};

export type SubDataSchemaConfig = {readonly [key: string]: string | DataSchemaConfig};

export type SubUISchemaConfig = {readonly [key: string]: UISchemaConfig | string};

////////////////////////////////////////////////////////////////////////////
// DataMapper Config
////////////////////////////////////////////////////////////////////////////

export type DataMapperNodeConfig = MapDataMapperNodeConfig | SingleDataMapperNodeConfig;

interface DataMapperNodeConfigBase {
  path: string;
  children?: Array<DataMapperNodeConfig>;
}

interface MapDataMapperNodeConfig extends DataMapperNodeConfigBase {
  type: 'map';
  directory: string;
}

interface SingleDataMapperNodeConfig extends DataMapperNodeConfigBase {
  type: 'single';
  directory?: string;
  fileName: string;
}

export interface DataMapperConfig {
  children: Array<DataMapperNodeConfig>;
}

////////////////////////////////////////////////////////////////////////////
// DataSchema Config
////////////////////////////////////////////////////////////////////////////
export interface DataSchemaConfigBase {
  label?: string;
  dataLabel?: string;
  dataDescription?: string;
}

export type DataSchemaConfig =
  | NumberDataSchemaConfig
  | BooleanDataSchemaConfig
  | StringDataSchemaConfig
  | MapDataSchemaConfig
  | FixedMapDataSchemaConfig
  | ListDataSchemaConfig
  | ConditionalDataSchemaConfig;

export type DataSchemaConfigType = DataSchemaConfig['type'];

export interface NumberDataSchemaConfig extends DataSchemaConfigBase {
  type: 'number';
}

export interface BooleanDataSchemaConfig extends DataSchemaConfigBase {
  type: 'boolean';
}

export interface StringDataSchemaConfig extends DataSchemaConfigBase {
  type: 'string';
  in?: SelectOptionConfig<string>;
}

export interface MapDataSchemaConfig extends DataSchemaConfigBase {
  type: 'map';
  item: DataSchemaConfig | string;
}

export interface FixedMapDataSchemaConfig extends DataSchemaConfigBase {
  type: 'fixed_map';
  items: {[key: string]: DataSchemaConfig | string};
}

export interface ListDataSchemaConfig extends DataSchemaConfigBase {
  type: 'list';
  item: DataSchemaConfig | string;
}

export interface ConditionalDataSchemaConfig extends DataSchemaConfigBase {
  type: 'conditional';
  items: {[key: string]: ConditionalDataSchemaItemConfig};
}

////////////////////////////////////////////////////////////////////////////
// Conditional Config
////////////////////////////////////////////////////////////////////////////
export type MatchConditionConfig<Path = string, Value = unknown> = {path: Path; readonly match: Value};
export type OrConditionConfig<Path = string, Value = unknown> = {readonly or: readonly ConditionConfig<Path, Value>[]};
export type AndConditionConfig<Path = string, Value = unknown> = {readonly and: readonly ConditionConfig<Path>[]};

export type ConditionConfig<Path = string, Value = unknown> =
  | MatchConditionConfig<Path, Value>
  | AndConditionConfig<Path, Value>
  | OrConditionConfig<Path, Value>;

export interface ConditionalSchemaItem<Item, Path = string, Value = unknown> {
  condition: ConditionConfig<Path, Value>;
  item: Item;
}

export type ConditionalDataSchemaItemConfig = ConditionalSchemaItem<DataSchemaConfig | string>;

////////////////////////////////////////////////////////////////////////////
// Select Option Config
////////////////////////////////////////////////////////////////////////////
export interface SelectDynamicOptionConfig {
  path: string;
  labelPath?: string;
  valuePath?: string;
}

export interface SelectStaticOptionConfig<T = number | string> {
  label: string;
  value: T;
}

export type SelectOptionConfigItem<T = number | string> =
  | string
  | SelectStaticOptionConfig<T>
  | SelectDynamicOptionConfig;

export type SelectOptionConfig<T = number | string> = SelectDynamicOptionConfig | readonly SelectOptionConfigItem<T>[];

////////////////////////////////////////////////////////////////////////////
// UIConfig Config
////////////////////////////////////////////////////////////////////////////
interface UISchemaConfigBase {
  readonly label?: string;
  readonly key?: string;
}

export type KeyOrKeyFlatten = {key?: string; keyFlatten?: false} | {keyFlatten: true};

export type UISchemaConfig =
  | MappingTableUISchemaConfig
  | CheckBoxUISchemaConfig
  | ContentListUISchemaConfig
  | FormUISchemaConfig
  | NumberUISchemaConfig
  | SelectUISchemaConfig
  | TableUISchemaConfig
  | TabUISchemaConfig
  | TextUISchemaConfig
  | ConditionalUISchemaConfig;

export type UISchemaConfigType = UISchemaConfig['type'];

export interface MappingTableUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'mappingTable';
  readonly sourcePath: string;
  readonly contents: ReadonlyArray<UISchemaConfig | string>;
}

export interface TextUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'text';
  readonly multiline?: boolean;
  readonly options?: ReadonlyArray<string>;
  // readonly references?: { [key: string]: TemplateReferenceConfig };
}

export type TabUISchemaConfig = {
  readonly type: 'tab';
  readonly label?: string;
  readonly contents: ReadonlyArray<UISchemaConfig | string>;
} & KeyOrKeyFlatten;

export interface TableUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'table';
  readonly dataType?: CollectionDataModelTypeString;
  readonly contents: ReadonlyArray<UISchemaConfig | string>;
}

export interface SelectUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'select';
  readonly emptyToNull?: boolean;
  readonly options?: SelectOptionConfig;
  readonly isMulti?: boolean;
}

export interface NumberUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'number';
}

export type FormUISchemaConfig = {
  readonly type: 'form';
  readonly label?: string;
  readonly contents: Array<UISchemaConfig | string>;
} & KeyOrKeyFlatten;

export interface ContentListUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'contentList';
  readonly listIndexKey?: string;
  readonly dataType?: CollectionDataModelTypeString;
  readonly content: UISchemaConfig | string;
}

export interface CheckBoxUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'checkbox';
}

export interface ConditionalUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'conditional';
  readonly conditions?: {readonly [key: string]: ConditionConfig};
  readonly conditionalContents: {readonly [key: string]: UISchemaConfig | string};
}

export type CollectionDataModelTypeString = 'list' | 'map';

// export interface TemplateReferencePathConfig {
//   readonly path: string;
//   readonly keyPath: string;
//   readonly description?: string;
// }
//
// export interface TemplateReferenceConfig {
//   readonly name?: string;
//   readonly paths: (TemplateReferencePathConfig | TemplateReferencePathConfig[])[];
// }
