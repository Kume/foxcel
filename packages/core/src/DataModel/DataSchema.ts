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
  forwardDataPathComponentToString,
  RootSchemaConfig,
  SelectDynamicOptionConfig,
  SelectOptionConfig,
  SelectOptionConfigItem,
  SelectStaticOptionConfig,
  EditingForwardDataPathComponent,
} from '..';
import {MultiDataPath, parsePath} from './DataPath';
import {FilePathConfigNamedItemMap, WritableFileBaseNamedItemNode} from '../common/commonTypes';
import DataStorage from '../Storage/DataStorage';
import {DataFormatter} from '../Storage/DataFormatter';
import {loadNestedConfigFile} from '../Storage/utils';
import {LoadedSchemaPath, parseSchemaReferenceConfig, resolveConfigOrRecursive} from '../common/schemaCommon';
import {dataPathToTemplateLine, parseTemplateLine, TemplateLine} from './TemplateEngine';

export enum DataSchemaType {
  Number,
  Boolean,
  String,
  Map,
  FixedMap,
  List,
  Conditional,
  Recursive,
  Key,
}

export type ConcreteDataSchema =
  | NumberDataSchema
  | BooleanDataSchema
  | StringDataSchema
  | MapDataSchema
  | FixedMapDataSchema
  | ListDataSchema
  | KeyDataSchema;

export type DataSchema = ConcreteDataSchema | ConditionalDataSchema | RecursiveDataSchema;

export type DataSchemaExcludeRecursive<T = DataSchema> = T extends RecursiveDataSchema ? never : T;

export type DataSchemaExclude<ExcludeType extends DataSchemaType, T = DataSchema> = T extends {t: ExcludeType}
  ? never
  : T;

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
  readonly contextKey?: never;
}

export interface BooleanDataSchema extends DataSchemaBase<boolean> {
  readonly t: DataSchemaType.Boolean;
  readonly contextKey?: never;
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
  readonly contextKey?: never;
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

export interface RecursiveDataSchema {
  readonly t: DataSchemaType.Recursive;
  // TODO recursiveのcontextKeyにアクセスさせては行けない気はする
  readonly contextKey?: never;
  readonly depth: number;
}

export interface ConditionalDataSchema {
  readonly t: DataSchemaType.Conditional;
  readonly contextKey?: never;
  readonly label: string | undefined;
  readonly defaultItem: DataSchemaExclude<DataSchemaType.Conditional>;
  readonly items: {
    readonly [key: string]: ConditionalSchemaItem<DataSchemaExclude<DataSchemaType.Conditional>, DataPath>;
  };
  readonly filePath?: readonly string[];
}

export interface KeyDataSchema {
  readonly t: DataSchemaType.Key;
  readonly contextKey?: never;
  readonly label: string | undefined;
}

export class DataSchemaContext {
  public static createRootContext(rootSchema: DataSchemaExcludeRecursive | undefined): DataSchemaContext {
    return new DataSchemaContext(rootSchema, rootSchema, rootSchema ? [rootSchema] : [], rootSchema ? 0 : 1, false);
  }

  private constructor(
    public readonly rootSchema: DataSchemaExcludeRecursive | undefined,
    public readonly currentSchema: DataSchemaExcludeRecursive | undefined,
    private readonly path: readonly DataSchemaExcludeRecursive[],
    private readonly emptyCount: number,
    public readonly isParentKey: boolean,
  ) {}

  public dig(key: {t: 'key'} | string | number | undefined | null): DataSchemaContext {
    if (key !== null && typeof key === 'object') {
      return this.pushParentKey();
    }

    switch (this.currentSchema?.t) {
      case DataSchemaType.Map:
      case DataSchemaType.List:
        // MapとListはキー(インデックス)に関わらず子のスキーマは一つであるため、そのまま子を返す。
        return this.createFromNext(this.currentSchema.item);
      case DataSchemaType.FixedMap:
        if (typeof key === 'string') {
          return this.createFromNext(this.currentSchema.items[key]);
        } else {
          return this.pushEmpty();
        }
      case DataSchemaType.Conditional:
        if (typeof key === 'string') {
          return this.createFromNext(this.currentSchema.items[key].item);
        } else {
          return this.createFromNext(this.currentSchema.defaultItem);
        }
      default:
        return this.pushEmpty();
    }
  }

  public contextKey(): string | undefined {
    return this.currentSchema?.contextKey;
  }

  public digByPath(pathComponent: EditingForwardDataPathComponent): DataSchemaContext {
    if (dataPathComponentIsKey(pathComponent)) {
      return this.pushParentKey();
    }
    switch (this.currentSchema?.t) {
      case DataSchemaType.Map:
      case DataSchemaType.List:
        // MapとListはキー(インデックス)に関わらず子のスキーマは一つであるため、そのまま子を返す。
        return this.createFromNext(this.currentSchema.item);
      case DataSchemaType.FixedMap: {
        if (dataPathComponentIsPointer(pathComponent)) {
          // pointerタイプのpathはfixedMapの子を指すためのポインターとしては利用されない想定
          return this.pushEmpty();
        }
        const key = forwardDataPathComponentToString(pathComponent);
        return this.currentSchema.items[key] && this.createFromNext(this.currentSchema.items[key]);
      }
      case DataSchemaType.Conditional:
        // TODO ここでconditionalを下降するためには実データがないと条件が定まらないので不可能?をもそもdataPathでdigするのが間違い?
        //  現状わからないので一旦undefinedを返す
        return this.pushEmpty();
      default:
        return this.pushEmpty();
    }
  }

  public getListChild(): DataSchemaContext {
    const {currentSchema} = this;
    if (currentSchema?.t === DataSchemaType.List) {
      return this.createFromNext(currentSchema.item);
    } else {
      return this.pushEmpty();
    }
  }

  private pushParentKey(): DataSchemaContext {
    return new DataSchemaContext(this.rootSchema, undefined, this.path, this.emptyCount, true);
  }

  private pushEmpty(): DataSchemaContext {
    if (this.isParentKey) {
      throw new Error('Cannot push any more because this context have reached parentKey');
    }
    return new DataSchemaContext(this.rootSchema, undefined, this.path, this.emptyCount + 1, false);
  }

  private createFromNext(next: DataSchema | undefined): DataSchemaContext {
    if (!next) {
      return this.pushEmpty();
    }
    if (this.isParentKey) {
      throw new Error('Cannot push any more because this context have reached parentKey');
    }
    const {rootSchema, path, emptyCount} = this;
    if (next.t === DataSchemaType.Recursive) {
      if (next.depth > path.length + emptyCount) {
        throw new Error('Invalid recursive depth');
      }
      return this.back(next.depth - 1);
    } else {
      return new DataSchemaContext(rootSchema, next, [...path, next], 0, false);
    }
  }

  public back(backCount = 1): DataSchemaContext {
    const sliceOffset = -backCount + this.emptyCount;
    return new DataSchemaContext(
      this.rootSchema,
      this.path[this.path.length - 1 + sliceOffset],
      this.path.slice(0, Math.min(sliceOffset, 0)),
      Math.max(sliceOffset, 0),
      false,
    );
  }

  public resolveRecursive<T extends DataSchema>(schema: T): DataSchemaExclude<DataSchemaType.Recursive, T>;
  public resolveRecursive<T extends DataSchema>(
    schema: T | undefined,
  ): DataSchemaExclude<DataSchemaType.Recursive, T> | undefined;
  public resolveRecursive<T extends DataSchema>(
    schema: T | undefined,
  ): DataSchemaExclude<DataSchemaType.Recursive, T> | undefined {
    if (!schema) {
      return undefined;
    }
    if (schema.t === DataSchemaType.Recursive) {
      if (schema.depth > this.path.length) {
        throw new Error('Invalid recursive depth');
      }
      return this.path[this.path.length - schema.depth] as DataSchemaExclude<DataSchemaType.Recursive, T>;
    } else {
      return schema as DataSchemaExclude<DataSchemaType.Recursive, T>;
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
      const items = parseConditions(config.items, (key, item) => {
        const parsed = parseChildDataSchemaConfig(item, pathConfigMap, filePath, loadedPath);
        if (dataSchemaIsConditional(parsed)) {
          throw new Error('Conditional内にConditionalのスキーマは定義できない');
        }
        return parsed;
      });
      const defaultItem = parseChildDataSchemaConfig(config.defaultItem, pathConfigMap, filePath, loadedPath);
      if (dataSchemaIsConditional(defaultItem)) {
        throw new Error('Conditional内にConditionalのスキーマは定義できない');
      }
      return {...baseSchema(config, DataSchemaType.Conditional), defaultItem, items};
    }
  }
}

function parseChildDataSchemaConfig(
  configOrReference: DataSchemaConfig | string,
  pathConfigMap: FilePathConfigNamedItemMap<DataSchemaConfig>,
  filePath: readonly string[],
  loadedPath: LoadedSchemaPath,
): DataSchema {
  const result = resolveConfigOrRecursive(
    configOrReference,
    dataSchemaConfigIsReference,
    (ref) => parseSchemaReferenceConfig(ref),
    pathConfigMap,
    filePath,
    loadedPath,
  );
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

export function dataSchemaIsConditional(schema: DataSchema | undefined): schema is ConditionalDataSchema {
  return schema?.t === DataSchemaType.Conditional;
}

function dataSchemaConfigIsReference(configOrReference: DataSchemaConfig | string): configOrReference is string {
  return typeof configOrReference === 'string';
}
