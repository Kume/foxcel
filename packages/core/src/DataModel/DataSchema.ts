import {
  ConditionalDataSchemaItemConfig,
  ConditionalSchemaItem,
  ConditionConfig,
  DataPath,
  dataPathComponentIsKey,
  dataPathComponentIsPointer,
  DataSchemaConfig,
  DataSchemaConfigBase,
  ForwardDataPath,
  ForwardDataPathComponent,
  forwardDataPathComponentToString,
  RootSchemaConfig,
  SelectDynamicOptionConfig,
  SelectOptionConfig,
  SelectOptionConfigItem,
  SelectStaticOptionConfig,
} from '..';
import {MultiDataPath, parsePath} from './DataPath';
import {CommonReferenceSchema, FilePathConfigNamedItemMap, WritableFileBaseNamedItemNode} from '../common/commonTypes';
import DataStorage from '../Storage/DataStorage';
import {DataFormatter} from '../Storage/DataFormatter';
import {loadNestedConfigFile} from '../Storage/utils';
import {LoadedSchemaPath, resolveConfigOrRecursive} from '../common/schemaCommon';
import {dataPathToTemplateLine, parseTemplateLine, TemplateLine} from './TemplateEngine';

export enum DataSchemaType {
  Number,
  Boolean,
  String,
  Map,
  FixedMap,
  List,
  Reference,
  Conditional,
  Recursive,
  Key,
}

export type DataSchema =
  | NumberDataSchema
  | BooleanDataSchema
  | StringDataSchema
  | MapDataSchema
  | FixedMapDataSchema
  | ListDataSchema
  | ConditionalDataSchema
  | RecursiveDataSchema
  | KeyDataSchema;

export type DataSchemaExcludeRecursive<T = DataSchema> = T extends RecursiveDataSchema ? never : T;

type TypeForType<T, Type> = T extends {t: Type} ? T : never;

export type DataSchemaForType<T extends DataSchemaType> = TypeForType<DataSchema, T>;

export interface DataSchemaBase<T> {
  readonly t: DataSchemaType;
  readonly label?: string;
  readonly dataLabel?: TemplateLine;
  readonly dataDescription?: string;
  readonly required?: boolean;
  readonly defaultToUndefined?: boolean;
  readonly default?: T;
  readonly filePath?: readonly string[];
}

export interface NumberDataSchema extends DataSchemaBase<number> {
  readonly t: DataSchemaType.Number;
}

export interface BooleanDataSchema extends DataSchemaBase<boolean> {
  readonly t: DataSchemaType.Boolean;
}

export interface SelectStaticOptionSchema<T> {
  readonly label: string;
  readonly value: T;
}

export interface SelectDynamicOptionSchema {
  readonly label?: undefined;
  readonly path: MultiDataPath;
  readonly labelTemplate?: TemplateLine;
  readonly valuePath: ForwardDataPath | undefined;
}

export type SelectOptionSchema<T> = SelectStaticOptionSchema<T> | SelectDynamicOptionSchema;

export interface StringDataSchema extends DataSchemaBase<string> {
  readonly t: DataSchemaType.String;
  readonly in?: readonly SelectOptionSchema<string>[];
}

export interface MapDataSchema extends DataSchemaBase<unknown> {
  readonly t: DataSchemaType.Map;
  readonly contextKey?: string;
  readonly sourcePath?: DataPath;
  readonly item?: DataSchema;
}

export interface FixedMapDataSchema extends DataSchemaBase<{[key: string]: any}> {
  readonly t: DataSchemaType.FixedMap;
  readonly contextKey?: string;
  readonly items: {readonly [key: string]: DataSchema};
}

export interface ListDataSchema extends DataSchemaBase<any[]> {
  readonly t: DataSchemaType.List;
  readonly contextKey?: string;
  readonly item?: DataSchema;
}

export interface ReferenceDataSchema extends CommonReferenceSchema {
  readonly t: DataSchemaType.Reference;
}

export interface RecursiveDataSchema {
  readonly t: DataSchemaType.Recursive;
  readonly depth: number;
}

export interface ConditionalDataSchema {
  readonly t: DataSchemaType.Conditional;
  readonly label: string | undefined;
  readonly items: {
    readonly [key: string]: ConditionalSchemaItem<DataSchema, DataPath>;
  };
  readonly filePath?: readonly string[];
}

export interface KeyDataSchema {
  readonly t: DataSchemaType.Key;
  readonly label: string | undefined;
}

export class DataSchemaContext {
  public static createRootContext(rootSchema: DataSchemaExcludeRecursive | undefined): DataSchemaContext | undefined {
    return rootSchema && new DataSchemaContext(rootSchema, rootSchema, []);
  }

  private constructor(
    public readonly rootSchema: DataSchemaExcludeRecursive,
    public readonly currentSchema: DataSchemaExcludeRecursive,
    private readonly path: readonly DataSchemaExcludeRecursive[],
  ) {}

  public dig(key: {t: 'key'} | string | number | undefined | null): DataSchemaContext | undefined {
    if (key !== null && typeof key === 'object') {
      // TODO DataSchemaContextをkeyまで対応させるなら何かしら実装が必要
      return undefined;
    }

    switch (this.currentSchema.t) {
      case DataSchemaType.Map:
      case DataSchemaType.List:
        // MapとListはキー(インデックス)に関わらず子のスキーマは一つであるため、そのまま子を返す。
        return this.currentSchema.item && this.createFromNext(this.currentSchema.item);
      case DataSchemaType.FixedMap:
        if (typeof key === 'string') {
          return this.currentSchema.items[key] && this.createFromNext(this.currentSchema.items[key]);
        } else {
          return undefined;
        }
      case DataSchemaType.Conditional:
        if (typeof key === 'string') {
          return this.currentSchema.items[key] && this.createFromNext(this.currentSchema.items[key].item);
        } else {
          return undefined;
        }
      default:
        return undefined;
    }
  }

  public digByPath(pathComponent: ForwardDataPathComponent): DataSchemaContext | undefined {
    if (dataPathComponentIsKey(pathComponent)) {
      // TODO DataSchemaContextをkeyまで対応させるなら何かしら実装が必要
      return undefined;
    }
    switch (this.currentSchema.t) {
      case DataSchemaType.Map:
      case DataSchemaType.List:
        // MapとListはキー(インデックス)に関わらず子のスキーマは一つであるため、そのまま子を返す。
        return this.currentSchema.item && this.createFromNext(this.currentSchema.item);
      case DataSchemaType.FixedMap: {
        if (dataPathComponentIsPointer(pathComponent)) {
          // pointerタイプのpathはfixedMapの子を指すためのポインターとしては利用されない想定
          return undefined;
        }
        const key = forwardDataPathComponentToString(pathComponent);
        return this.currentSchema.items[key] && this.createFromNext(this.currentSchema.items[key]);
      }
      case DataSchemaType.Conditional:
        // TODO ここでconditionalを下降するためには実データがないと条件が定まらないので不可能?をもそもdataPathでdigするのが間違い?
        //  現状わからないので一旦undefinedを返す
        return undefined;
      default:
        return undefined;
    }
  }

  public getMapChild(): DataSchemaContext | undefined {
    const {currentSchema} = this;
    if (currentSchema.t !== DataSchemaType.Map) {
      return;
    }
    return currentSchema.item && this.createFromNext(currentSchema.item);
  }

  public getFixedMapChild(key: string): DataSchemaContext | undefined {
    const {currentSchema} = this;
    if (currentSchema.t !== DataSchemaType.FixedMap) {
      return;
    }
    return currentSchema.items[key] && this.createFromNext(currentSchema.items[key]);
  }

  public getListChild(): DataSchemaContext | undefined {
    const {currentSchema} = this;
    if (currentSchema.t !== DataSchemaType.List) {
      return;
    }
    return currentSchema.item && this.createFromNext(currentSchema.item);
  }

  private createFromNext(next: DataSchema): DataSchemaContext | undefined {
    const {rootSchema, path} = this;
    if (next.t === DataSchemaType.Recursive) {
      if (next.depth > path.length) {
        throw new Error('Invalid recursive depth');
      }
      return new DataSchemaContext(rootSchema, path[path.length - next.depth], path.slice(0, -next.depth));
    } else {
      return new DataSchemaContext(rootSchema, next, [...path, next]);
    }
  }

  public resolveRecursive(schema: DataSchema): DataSchemaExcludeRecursive;
  public resolveRecursive(schema: DataSchema | undefined): DataSchemaExcludeRecursive | undefined;
  public resolveRecursive(schema: DataSchema | undefined): DataSchemaExcludeRecursive | undefined {
    if (!schema) {
      return undefined;
    }
    if (schema.t === DataSchemaType.Recursive) {
      if (schema.depth > this.path.length) {
        throw new Error('Invalid recursive depth');
      }
      return this.path[this.path.length - schema.depth];
    } else {
      return schema;
    }
  }
}

function isDynamicOptionConfig<T>(
  config: SelectStaticOptionConfig<T> | SelectDynamicOptionConfig,
): config is SelectDynamicOptionConfig {
  return config.path !== undefined;
}

export function parseOptionConfig(config: SelectOptionConfig<string>): readonly SelectOptionSchema<string>[];
export function parseOptionConfig(
  config: SelectOptionConfig<string | number>,
): readonly SelectOptionSchema<string | number>[];
export function parseOptionConfig(
  config: SelectOptionConfig<string | number>,
): readonly SelectOptionSchema<string | number>[] {
  if (Array.isArray(config)) {
    return config.map(parseOptionConfigItem);
  } else {
    return [parseDynamicOptionConfigItem(config)];
  }
}

export function parseOptionConfigItem(config: SelectOptionConfigItem<string>): SelectOptionSchema<string>;
export function parseOptionConfigItem(
  config: SelectOptionConfigItem<string | number>,
): SelectOptionSchema<string | number>;
export function parseOptionConfigItem(
  config: SelectOptionConfigItem<string | number>,
): SelectOptionSchema<string | number> {
  if (typeof config === 'string' || typeof config === 'number') {
    return {label: config.toString(), value: config};
  }
  if (isDynamicOptionConfig(config)) {
    return parseDynamicOptionConfigItem(config);
  } else {
    return {...config};
  }
}

function parseDynamicOptionConfigItem(config: SelectDynamicOptionConfig): SelectDynamicOptionSchema {
  return {
    path: parsePath(config.path),
    labelTemplate: config.label
      ? parseTemplateLine(config.label)
      : config.labelPath
      ? dataPathToTemplateLine(parsePath(config.labelPath, 'single'))
      : undefined,
    valuePath: (config.valuePath && parsePath(config.valuePath, 'forward')) || undefined,
  };
}

export function parseCondition(source: ConditionConfig): ConditionConfig<DataPath> {
  if ('match' in source) {
    return {match: source.match, path: parsePath(source.path, 'single')};
  } else if ('or' in source) {
    return {or: source.or.map((i) => parseCondition(i))};
  } else if ('and' in source) {
    return {and: source.and.map((i) => parseCondition(i))};
  }
  throw new Error('Invalid condition');
}

export function parseConditions<DistItem>(
  sourceConditions: {[key: string]: ConditionalDataSchemaItemConfig},
  parseItem: (key: string, item: DataSchemaConfig | string) => DistItem,
): {readonly [key: string]: ConditionalSchemaItem<DistItem, DataPath>} {
  const conditions: {[key: string]: ConditionalSchemaItem<DistItem, DataPath>} = {};
  for (const key of Object.keys(sourceConditions)) {
    conditions[key] = {
      condition: parseCondition(sourceConditions[key].condition),
      item: parseItem(key, sourceConditions[key].item),
    };
  }
  return conditions;
}

function baseSchema<T extends DataSchemaType>(config: DataSchemaConfigBase, type: T) {
  return {
    t: type,
    label: config.label,
    dataLabel: config.dataLabel === undefined ? undefined : parseTemplateLine(config.dataLabel),
    dataDescription: config.dataDescription,
  };
}

function parseDataSchemaConfig(
  config: DataSchemaConfig,
  pathConfigMap: FilePathConfigNamedItemMap<DataSchemaConfig>,
  filePath: readonly string[] = [],
  loadedPath: LoadedSchemaPath = [],
): DataSchema {
  switch (config.type) {
    case 'number': {
      return {...baseSchema(config, DataSchemaType.Number)};
    }
    case 'boolean': {
      return {...baseSchema(config, DataSchemaType.Boolean)};
    }
    case 'fixed_map': {
      const items: {[key: string]: DataSchema} = {};
      for (const key of Object.keys(config.items)) {
        items[key] = parseChildDataSchemaConfig(config.items[key], pathConfigMap, filePath, loadedPath);
      }
      return {...baseSchema(config, DataSchemaType.FixedMap), items};
    }
    case 'list': {
      const item = parseChildDataSchemaConfig(config.item, pathConfigMap, filePath, loadedPath);
      return {...baseSchema(config, DataSchemaType.List), item};
    }
    case 'map': {
      const item = parseChildDataSchemaConfig(config.item, pathConfigMap, filePath, loadedPath);
      return {...baseSchema(config, DataSchemaType.Map), item};
    }
    case 'string': {
      const option = config.in && parseOptionConfig(config.in);
      return {...baseSchema(config, DataSchemaType.String), in: option};
    }
    case 'conditional': {
      const items = parseConditions(config.items, (key, item) =>
        parseChildDataSchemaConfig(item, pathConfigMap, filePath, loadedPath),
      );
      return {...baseSchema(config, DataSchemaType.Conditional), items};
    }
  }
}

function parseChildDataSchemaConfig(
  configOrReference: DataSchemaConfig | string,
  pathConfigMap: FilePathConfigNamedItemMap<DataSchemaConfig>,
  filePath: readonly string[],
  loadedPath: LoadedSchemaPath,
): DataSchema {
  const result = resolveConfigOrRecursive(configOrReference, pathConfigMap, filePath, loadedPath);
  if (result.type === 'recursive') {
    return {t: DataSchemaType.Recursive, depth: result.depth};
  } else {
    return parseDataSchemaConfig(result.config, pathConfigMap, result.filePath, result.loadedPath);
  }
}

export async function buildDataSchema(
  rootSchemaConfig: RootSchemaConfig,
  storage: DataStorage,
  formatter: DataFormatter,
): Promise<DataSchemaExcludeRecursive> {
  const namedDataSchema: WritableFileBaseNamedItemNode<DataSchemaConfig> = {filePath: []};
  const loadedDataSchema = new Map([['', namedDataSchema]]);
  await loadNestedConfigFile(
    rootSchemaConfig.namedDataSchema || {},
    namedDataSchema,
    loadedDataSchema,
    (config) => config, // TODO バリデーション
    storage,
    formatter,
  );
  return parseDataSchemaConfig(rootSchemaConfig.dataSchema, loadedDataSchema) as DataSchemaExcludeRecursive; // TODO
}

export function buildSimpleDataSchema(rootSchemaConfig: RootSchemaConfig): DataSchemaExcludeRecursive {
  const namedDataSchema: WritableFileBaseNamedItemNode<DataSchemaConfig> = {filePath: []};
  const loadedDataSchema = new Map([['', namedDataSchema]]);
  return parseDataSchemaConfig(rootSchemaConfig.dataSchema, loadedDataSchema) as DataSchemaExcludeRecursive; // TODO
}

export function getByKeyForFixedMapDataSchema(map: FixedMapDataSchema, key: string): DataSchema | undefined {
  return map.items[key];
}

export interface DataSchemaContextKeyItem {
  key: string;
  depth: number;
}

export function dataSchemaIsFixedMap(schema: DataSchema | undefined): schema is FixedMapDataSchema {
  return schema?.t === DataSchemaType.FixedMap;
}

export function dataSchemaIsMap(schema: DataSchema | undefined): schema is MapDataSchema {
  return schema?.t === DataSchemaType.Map;
}

export function dataSchemaIsList(schema: DataSchema | undefined): schema is ListDataSchema {
  return schema?.t === DataSchemaType.List;
}

export function dataSchemaIsString(schema: DataSchema | undefined): schema is StringDataSchema {
  return schema?.t === DataSchemaType.String;
}

export function dataSchemaIsNumber(schema: DataSchema | undefined): schema is NumberDataSchema {
  return schema?.t === DataSchemaType.Number;
}

export function dataSchemaIsBoolean(schema: DataSchema | undefined): schema is BooleanDataSchema {
  return schema?.t === DataSchemaType.Boolean;
}
