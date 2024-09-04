export type SchemaVersion = '2.0' | '1.0';

export type RootSchemaConfig = {
  readonly version?: SchemaVersion;
  readonly namedDataSchema?: SubDataSchemaConfig;
  // TODO optionalにする
  readonly dataSchema: DataSchemaConfig;
  readonly namedUiSchema?: SubUISchemaConfig;
  readonly fileMap: DataMapperConfig;
} & UISchemaConfigHolder;

type UISchemaConfigHolder = {readonly uiRoot: UISchemaConfig /* old schema */} | {readonly uiSchema: UISchemaConfig};

export type SubDataSchemaConfig = {readonly [key: string]: string | DataSchemaConfig};

export type SubUISchemaConfig = {readonly [key: string]: UISchemaConfigOrReference};

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
  children: readonly DataMapperNodeConfig[];
}

////////////////////////////////////////////////////////////////////////////
// DataSchema Config
////////////////////////////////////////////////////////////////////////////
export interface DataSchemaConfigBase {
  readonly label?: string;
  readonly dataLabel?: string;
  readonly dataDescription?: string;
  readonly required?: boolean;
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

// TODO 引数名を指定しなくてよいか考える
export type ScriptArgumentConfig = string | {readonly path: string; readonly withPath?: boolean};

export type ScriptValidationConfig =
  | string
  | {
      readonly code: string;
      readonly args?: ScriptArgumentConfig | readonly ScriptArgumentConfig[];
    };

export type VariablesConfig = Readonly<Record<string, string>>;

// TODO signedやfloatに対応
export type NumberType = 'unsignedInteger';

export interface NumberDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'number';

  /**
   * @default 'unsignedInteger'
   */
  readonly numberType?: NumberType;

  readonly validation?: NumberDataSchemaValidationConfig;
}

export interface NumberDataSchemaValidationConfig {
  readonly max?: number;
  readonly min?: number;
  readonly script?: ScriptValidationConfig;
}

export interface BooleanDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'boolean';
  readonly validation?: BooleanDataSchemaValidationConfig;
}

export interface BooleanDataSchemaValidationConfig {
  readonly script?: ScriptValidationConfig;
}

export interface StringDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'string';
  readonly in?: SelectOptionConfig<string>;
  readonly validation?:
    | StringDataSchemaValidationConfig
    | StringDataSchemaValidationConfigPreset
    | readonly StringDataSchemaValidationConfigPreset[];
}

export type StringDataSchemaValidationConfigPreset =
  | 'camelCase'
  | 'snake_case'
  | 'PascalCase'
  | 'UPPER_SNAKE_CASE'
  | 'kebab-case'
  | 'safe-identifier'
  | 'alpha-num'
  | 'alpha-num-underscore'
  | 'alpha-num-hyphen';

export interface StringDataSchemaValidationConfig {
  readonly regexp?: string;
  readonly preset?: StringDataSchemaValidationConfigPreset | readonly StringDataSchemaValidationConfigPreset[];
  readonly script?: ScriptValidationConfig;
}

export interface MapDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'map';
  readonly contextKey?: string;
  /**
   * v2.0より前のvariables
   */
  readonly pathAlias?: VariablesConfig;
  /**
   * ver2.0以降用
   */
  readonly variables?: VariablesConfig;
  readonly item: DataSchemaConfig | string;
  readonly mappedFrom?: string;
  readonly validation?: MapDataSchemaValidationConfig;
}

export interface MapDataSchemaValidationConfig {
  readonly script?: ScriptValidationConfig;
}

export interface FixedMapDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'fixed_map';
  readonly contextKey?: string;
  /**
   * v2.0より前のvariables
   */
  readonly pathAlias?: VariablesConfig;
  /**
   * ver2.0以降用
   */
  readonly variables?: VariablesConfig;
  readonly items: {readonly [key: string]: DataSchemaConfig | string};
  readonly validation?: FixedMapDataSchemaValidationConfig;
}

export interface FixedMapDataSchemaValidationConfig {
  readonly script?: ScriptValidationConfig;
}

export interface ListDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'list';
  readonly contextKey?: string;
  /**
   * v2.0より前のvariables
   */
  readonly pathAlias?: VariablesConfig;
  /**
   * ver2.0以降用
   */
  readonly variables?: VariablesConfig;
  readonly item: DataSchemaConfig | string;
  readonly validation?: ListDataSchemaValidationConfig;
}

export interface ListDataSchemaValidationConfig {
  readonly script?: ScriptValidationConfig;
}

export interface ConditionalDataSchemaConfig extends DataSchemaConfigBase {
  readonly type: 'conditional';
  readonly defaultItem: DataSchemaConfig | string;
  readonly items: {readonly [key: string]: ConditionalDataSchemaItemConfig};
  readonly validation?: ConditionalDataSchemaValidationConfig;
}

export interface ConditionalDataSchemaValidationConfig {
  readonly script?: ScriptValidationConfig;
}

////////////////////////////////////////////////////////////////////////////
// Conditional Config
////////////////////////////////////////////////////////////////////////////
export type MatchConditionConfig<Path = string, Value = unknown> = {readonly path: Path; readonly match: Value};
export type OrConditionConfig<Path = string, Value = unknown> = {readonly or: readonly ConditionConfig<Path, Value>[]};
export type AndConditionConfig<Path = string, Value = unknown> = {
  readonly and: readonly ConditionConfig<Path, Value>[];
};

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
  label?: string;
  labelPath?: string;
  valuePath?: string;
}

export interface SelectStaticOptionConfig<T = number | string> {
  label: string;
  path?: undefined;
  value: T;
}

export type SelectOptionConfigItem<T = number | string> = T | SelectStaticOptionConfig<T> | SelectDynamicOptionConfig;

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

export interface UISchemaReference {
  readonly type: 'ref';
  readonly ref: string;
  readonly key?: string;
}

export type UISchemaConfigOrReference = UISchemaConfig | UISchemaReference;

export type UISchemaConfigType = UISchemaConfig['type'];

export interface MappingTableUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'mappingTable';
  readonly sourcePath: string;
  readonly contents: ReadonlyArray<UISchemaConfigOrReference>;
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
  readonly contents: ReadonlyArray<UISchemaConfigOrReference>;
} & KeyOrKeyFlatten;

export interface TableUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'table';
  readonly dataType?: CollectionDataModelTypeString;
  readonly contents: ReadonlyArray<UISchemaConfigOrReference>;
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
  readonly contents: ReadonlyArray<UISchemaConfigOrReference>;
} & KeyOrKeyFlatten;

export interface ContentListUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'contentList';
  readonly listIndexKey?: string;
  readonly dataType?: CollectionDataModelTypeString;
  readonly content: UISchemaConfigOrReference;
}

export interface CheckBoxUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'checkbox';
}

export interface ConditionalUISchemaConfig extends UISchemaConfigBase {
  readonly type: 'conditional';
  readonly defaultContent: UISchemaConfigOrReference;
  readonly conditions?: {readonly [key: string]: ConditionConfig};
  readonly conditionalContents: {readonly [key: string]: UISchemaConfigOrReference};
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
