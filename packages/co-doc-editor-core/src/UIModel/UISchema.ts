import type {KeySymbolType} from '../DataModel/DataPath';
import {
  CollectionDataModelTypeString,
  ConditionalUISchemaConfig,
  ConditionConfig,
  ContentListUISchemaConfig,
  DataPath,
  dataPathComponentIsKey,
  dataPathComponentIsMapKeyLike,
  dataPathComponentToMapKey,
  ForwardDataPathComponent,
  KeyOrKeyFlatten,
  keySymbol,
  MappingTableUISchemaConfig,
  parsePath,
  RootSchemaConfig,
  SelectUISchemaConfig,
  TableUISchemaConfig,
  UISchemaConfig,
} from '..';
import pick from 'lodash.pick';
import {mapObjectToObject, mapToObject} from '../common/utils';
import DataStorage from '../Storage/DataStorage';
import {DataFormatter} from '../Storage/DataFormatter';
import {NamedItemNode} from '../common/commonTypes';
import {loadNestedConfigFile} from '../Storage/utils';
import {LoadedSchemaPath, PathConfigMap, resolveConfigOrRecursive} from '../common/schemaCommon';
import {
  BooleanDataSchema,
  ConditionalDataSchema,
  copyKeyOrKeyFlatten,
  DataSchema,
  DataSchemaContext,
  DataSchemaExcludeRecursive,
  DataSchemaForType,
  DataSchemaType,
  FixedMapDataSchema,
  getByKeyForFixedMapDataSchema,
  ListDataSchema,
  MapDataSchema,
  NumberDataSchema,
  parseCondition,
  parseOptionConfig,
  SelectOptionSchema,
  StringDataSchema,
} from '../DataModel/DataSchema';

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

type UISchemaExcludeRecursive<E = UISchema> = E extends RecursiveUISchema ? never : E;

export type UISchemaType = UISchema['type'];

interface UISchemaBase {
  readonly label?: string;
  readonly key?: string | KeySymbolType;
}

export interface MappingTableUISchema extends UISchemaBase {
  readonly type: 'mappingTable';
  readonly dataSchema: MapDataSchema;
  readonly sourcePath: DataPath;
  readonly contents: ReadonlyArray<UISchema>;
}

export interface TextUISchema extends UISchemaBase {
  readonly type: 'text';
  readonly dataSchema: StringDataSchema;
}

export interface TabUISchema extends UISchemaBase {
  readonly type: 'tab';
  readonly dataSchema: FixedMapDataSchema;
  readonly keyFlatten?: boolean;
  readonly contents: ReadonlyArray<UISchema>;
}

export interface TableUISchema extends UISchemaBase {
  readonly type: 'table';
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly contents: ReadonlyArray<UISchema>;
}

export type SelectUISchema = SingleSelectUISchema | MultiSelectUISchema;

interface SelectUISchemaBase extends UISchemaBase {
  readonly type: 'select';
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
  readonly dataSchema: NumberDataSchema;
}

export interface FormUISchema extends UISchemaBase {
  readonly type: 'form';
  readonly dataSchema: FixedMapDataSchema;
  readonly keyFlatten?: boolean;
  readonly contents: ReadonlyArray<UISchema>;
}

export interface ContentListUISchema extends UISchemaBase {
  readonly type: 'contentList';
  readonly dataSchema: ListDataSchema | MapDataSchema;
  readonly content: UISchema;
}

export interface CheckBoxUISchema extends UISchemaBase {
  readonly type: 'checkbox';
  readonly dataSchema: BooleanDataSchema;
}

export interface ConditionalUISchema extends UISchemaBase {
  readonly type: 'conditional';
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

export interface UISchemaParsingContext {
  readonly uiPath: ReadonlyArray<{key?: string; type: UISchemaType}>;
  readonly dataPath: ReadonlyArray<{key: string | number | null; type: DataSchemaType}> | undefined;
  // readonly namespace: readonly string[]; TODO 消す
  // readonly namedKeyMap: NamedItemManager<KeyOrKeyFlatten>;
  readonly dataSchemaContext: DataSchemaContext | undefined;
  readonly loadedPath: LoadedSchemaPath<DataSchema>;
  readonly filePath: readonly string[];
}

export const createRootUiSchemaParsingContext = (
  dataSchema: DataSchemaExcludeRecursive | undefined,
): UISchemaParsingContext => ({
  uiPath: [],
  dataPath: [],
  dataSchemaContext: DataSchemaContext.createRootContext(dataSchema),
  loadedPath: [],
  filePath: [],
});

class UISchemaParseError extends Error {
  constructor(message: string, public readonly context: UISchemaParsingContext) {
    super(message);
  }
}

function pushToContext(
  context: UISchemaParsingContext,
  ui: {key?: string; type: UISchemaType} | undefined,
  data: {key: string | number | null; type: DataSchemaType} | undefined,
  // loadedPath?: LoadedSchemaPath<DataSchema>,
  // filePath?: readonly string[],
): UISchemaParsingContext {
  return {
    ...context,
    uiPath: ui ? [...context.uiPath, ui] : context.uiPath,
    dataPath: data && context.dataPath && [...context.dataPath, data],
    dataSchemaContext: context?.dataSchemaContext?.dig(data?.key),
    // loadedPath: loadedPath ?? context.loadedPath,
    // filePath: filePath ?? context.filePath, // TODO この関数の呼び出し側でfilePathを適切にセットする
  };
}

function setFilePathToContext(
  context: UISchemaParsingContext,
  loadedPath?: LoadedSchemaPath<DataSchema>,
  filePath?: readonly string[],
): UISchemaParsingContext {
  return {
    ...context,
    loadedPath: loadedPath ?? context.loadedPath,
    filePath: filePath ?? context.filePath,
  };
}

function pushToDataSchemaContext(
  context: DataSchemaContext | undefined,
  data: {key: string | number | null; type: DataSchemaType} | undefined,
): DataSchemaContext | undefined {
  if (!context) {
    return undefined;
  }
  switch (data?.type) {
    case DataSchemaType.List:
      return context.getListChild();
    case DataSchemaType.Map:
      return context.getMapChild();
    case DataSchemaType.FixedMap:
      return typeof data?.key === 'string' ? context.getFixedMapChild(data?.key) : undefined;

    case DataSchemaType.Conditional: // TODO
    default:
      return undefined;
  }
}

export class UISchemaContext {
  public static createRootContext(
    rootSchema: UISchemaExcludeRecursive,
    dataSchemaContext: DataSchemaContext,
  ): UISchemaContext {
    return new UISchemaContext(rootSchema, rootSchema, dataSchemaContext, []);
  }

  private constructor(
    public readonly rootSchema: UISchemaExcludeRecursive,
    public readonly currentSchema: UISchemaExcludeRecursive,
    public readonly dataSchemaContext: DataSchemaContext,
    private readonly path: readonly UISchemaExcludeRecursive[],
  ) {}
}

function createConditionMap(dataSchema: ConditionalDataSchema | undefined, config: ConditionalUISchemaConfig) {
  const conditionMap: {
    [key: string]: {
      dataSchema?: DataSchema;
      condition: ConditionConfig<DataPath>;
    };
  } = {};
  if (dataSchema?.items) {
    for (const key of Object.keys(dataSchema.items)) {
      conditionMap[key] = {
        condition: dataSchema.items[key].condition,
        dataSchema: dataSchema.items[key].item,
      };
    }
  }
  if (config.conditions) {
    for (const key of Object.keys(config.conditions)) {
      conditionMap[key] = {condition: parseCondition(config.conditions[key])};
    }
  }
  return conditionMap;
}

type ConfirmedKeyFlatten<T extends KeyOrKeyFlatten> = T extends {keyFlatten: boolean} ? T : never;

export function isKeyFlatten<T extends KeyOrKeyFlatten>(config: T): config is ConfirmedKeyFlatten<T> {
  return Boolean('keyFlatten' in config && config.keyFlatten);
}

function assertDataSchemaType<T extends DataSchemaType>(
  dataSchema: DataSchema | undefined,
  context: UISchemaParsingContext,
  type: T | readonly T[],
  required: true,
): asserts dataSchema is DataSchemaForType<T>;
function assertDataSchemaType<T extends DataSchemaType>(
  dataSchema: DataSchema | undefined,
  context: UISchemaParsingContext,
  type: T | T[],
  required?: false,
): asserts dataSchema is DataSchemaForType<T> | undefined;
function assertDataSchemaType(
  dataSchema: DataSchema | undefined,
  context: UISchemaParsingContext,
  type: DataSchemaType | DataSchemaType[],
  required?: boolean,
) {
  if (dataSchema) {
    if (!Array.isArray(type)) {
      type = [type];
    }
    if (!type.some((t) => t === dataSchema.t)) {
      throw new UISchemaParseError('invalid data schema type', context);
    }
  } else {
    if (required) {
      throw new UISchemaParseError('missing data schema', context);
    }
  }
}

function optionsFromDataSchema(
  dataSchema: DataSchema | undefined,
  context: UISchemaParsingContext,
): readonly SelectOptionSchema<string | number>[] | undefined {
  assertDataSchemaType(dataSchema, context, DataSchemaType.String | DataSchemaType.Number);
  if (dataSchema && dataSchema.t === DataSchemaType.String) {
    return dataSchema.in;
  }
}

function parseSelectUISchemaConfig(
  config: SelectUISchemaConfig,
  context: UISchemaParsingContext,
  dataSchema: DataSchema | undefined,
): SelectUISchema {
  if (config.isMulti) {
    assertDataSchemaType(dataSchema, context, DataSchemaType.List);
    const options =
      optionsFromDataSchema(context.dataSchemaContext?.resolveRecursive(dataSchema?.item), context) ||
      (config.options && parseOptionConfig(config.options));
    if (!options) {
      throw new UISchemaParseError('options config not found.', context);
    }
    return {
      ...pick(config, 'type', 'key', 'label', 'emptyToNull'),
      isMulti: true,
      dataSchema: overwriteObject<ListDataSchema>(dataSchema, {t: DataSchemaType.List, label: config.label}),
      options,
    };
  } else {
    assertDataSchemaType(dataSchema, context, DataSchemaType.String);
    const options = optionsFromDataSchema(dataSchema, context) || (config.options && parseOptionConfig(config.options));
    if (!options) {
      throw new UISchemaParseError('options config not found.', context);
    }
    return {
      ...pick(config, 'type', 'key', 'label'),
      isMulti: false,
      dataSchema: overwriteObject<StringDataSchema>(dataSchema, {label: config.label}),
      options,
    };
  }
}

function dataSchemaTypeToCollectionType(type: DataSchemaType | undefined): CollectionDataModelTypeString | undefined {
  if (!type) {
    return undefined;
  }
  switch (type) {
    case DataSchemaType.List:
      return 'list';
    case DataSchemaType.Map:
      return 'map';
    default:
      return undefined;
  }
}

function collectionTypeToDataSchemaType(type: CollectionDataModelTypeString): DataSchemaType.List | DataSchemaType.Map {
  switch (type) {
    case 'list':
      return DataSchemaType.List;
    case 'map':
      return DataSchemaType.Map;
  }
}

// function overwriteObject<T>(item1: T | undefined, item2: Partial<T> | undefined): T;
// function overwriteObject<T>(item1: Partial<T> | undefined, item2: T | undefined): T;
// function overwriteObject<T>(item1: T | undefined, item2: Partial<T> | undefined, item3: Partial<T> | undefined): T;
// function overwriteObject<T>(item1: Partial<T> | undefined, item2: T | undefined, item3: Partial<T> | undefined): T;
// function overwriteObject<T>(item1: Partial<T> | undefined, item2: Partial<T> | undefined, item3: T | undefined): T;
function overwriteObject<T>(...items: readonly (Partial<T> | undefined)[]): T {
  const ret: {[key: string]: any} = {};
  for (const item of items) {
    if (item) {
      for (const key of Object.keys(item)) {
        const itemProperty = (item as any)[key];
        if (itemProperty !== undefined) {
          ret[key] = itemProperty;
        }
      }
    }
  }
  return ret as T;
}

function parseContentListUISchemaConfig(
  config: ContentListUISchemaConfig,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | ListDataSchema | undefined,
): ContentListUISchema {
  const nextContext = pushToContext(
    context,
    {type: config.type},
    dataSchema && {key: config.key || null, type: dataSchema.t},
  );
  const content = parseConfigOrReference(
    config.content,
    pathConfigMap,
    nextContext,
    nextContext.dataSchemaContext?.resolveRecursive(dataSchema?.item),
  );
  return {
    ...pick(config, 'type', 'key', 'label'),
    dataSchema: overwriteObject<MapDataSchema | ListDataSchema>(
      {t: collectionTypeToDataSchemaType(config.dataType || 'list')},
      dataSchema,
      {item: content.dataSchema, label: config.label},
    ),
    content,
  };
}

export function getUiSchemaUniqueKeyOrUndefined(schema: UISchema): string | undefined {
  if (schema.type === 'recursive') {
    throw new Error('Not implemented');
  } else {
    return typeof schema.key === 'symbol' ? undefined : schema.key;
  }
}

function parseChildrenDataSchema(
  contentsConfig: ReadonlyArray<UISchemaConfig | string>,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  childDataSchema: FixedMapDataSchema | undefined,
): {dataSchema: FixedMapDataSchema; contents: readonly UISchema[]} {
  const contents = contentsConfig.map((rowConfig) => {
    const [cellContext, cellDataSchema] = nextChildDataSchema(rowConfig, pathConfigMap, childDataSchema, context);
    return parseConfigOrReference(rowConfig, pathConfigMap, cellContext, cellDataSchema);
  });
  const contentsByKey = new Map<string, UISchema>(
    contents
      .map((content) => [getUiSchemaUniqueKeyOrUndefined(content) || '', content] as const)
      .filter(([key]) => key),
  );
  const itemKeys = [...new Set([...Object.keys(childDataSchema?.items || {}), ...contentsByKey.keys()])];
  const dataSchema = overwriteObject<FixedMapDataSchema>({t: DataSchemaType.FixedMap}, childDataSchema, {
    items: mapToObject(
      itemKeys,
      (key) => [key, contentsByKey.get(key)?.dataSchema || childDataSchema?.items?.[key]],
      true,
    ),
  });
  return {dataSchema, contents};
}

function parseTableUISchemaConfig(
  config: TableUISchemaConfig,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | ListDataSchema | undefined,
  rowDataSchema: FixedMapDataSchema | undefined,
): TableUISchema {
  const rowContext = pushToContext(
    context,
    {type: config.type},
    dataSchema && {key: config.key || null, type: dataSchema.t},
  );
  const {dataSchema: childDataSchema, contents} = parseChildrenDataSchema(
    config.contents,
    pathConfigMap,
    rowContext,
    rowDataSchema,
  );
  const fixedDataSchema = overwriteObject<MapDataSchema | ListDataSchema>(
    {t: collectionTypeToDataSchemaType(config.dataType || 'list')},
    dataSchema,
    {label: config.label, item: childDataSchema},
  );
  return {...pick(config, 'type', 'key', 'label'), dataSchema: fixedDataSchema, contents};
}

function parseMappingTableUISchemaConfig(
  config: MappingTableUISchemaConfig,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | undefined,
  rowDataSchema: FixedMapDataSchema | undefined,
): MappingTableUISchema {
  const rowContext = pushToContext(
    context,
    {type: config.type},
    dataSchema && {key: config.key || null, type: dataSchema.t},
  );
  const {dataSchema: childDataSchema, contents} = parseChildrenDataSchema(
    config.contents,
    pathConfigMap,
    rowContext,
    rowDataSchema,
  );
  const fixedSchema = overwriteObject<MapDataSchema>({t: DataSchemaType.Map}, dataSchema, {
    label: config.label,
    item: childDataSchema,
  });
  return {
    ...pick(config, 'type', 'key', 'label'),
    sourcePath: parsePath(config.sourcePath, 'single'),
    contents,
    dataSchema: fixedSchema,
  };
}

function nextChildDataSchema(
  configOrReference: UISchemaConfig | string,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  dataSchema: FixedMapDataSchema | undefined,
  context: UISchemaParsingContext,
): [UISchemaParsingContext, DataSchema | undefined] {
  const resolved = resolveConfigOrRecursive(
    configOrReference,
    pathConfigMap,
    context.filePath,
    context.loadedPath,
    dataSchema,
  );
  if (resolved.type === 'recursive') {
    throw new Error('Not implemented'); // TODO
    // return [pushToContext(), result.additionalPathInfo];
  } else {
    if (isKeyFlatten(resolved.config)) {
      return [context, dataSchema];
    } else {
      let dataPathComponent: {key: string; type: DataSchemaType} | undefined;
      let childDataSchema: DataSchema | undefined;
      if (dataSchema) {
        childDataSchema = context.dataSchemaContext?.resolveRecursive(
          getByKeyForFixedMapDataSchema(dataSchema, resolved.config.key!),
        );
        dataPathComponent = childDataSchema && {key: resolved.config.key!, type: childDataSchema.t};
      }
      return [pushToContext(context, undefined, dataPathComponent), childDataSchema];
    }
  }
}

export function parseUISchemaConfig2(
  config: UISchemaConfig,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: DataSchema | undefined,
): UISchemaExcludeRecursive {
  const resolvedDataSchema = context.dataSchemaContext?.resolveRecursive(dataSchema);
  switch (config.type) {
    case 'checkbox':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Boolean);
      return {
        ...pick(config, 'type', 'key', 'label'),
        dataSchema: overwriteObject<BooleanDataSchema>({t: DataSchemaType.Boolean}, resolvedDataSchema, {
          label: config.label,
        }),
      };

    case 'number':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Number);
      return {
        ...pick(config, 'type', 'key', 'label'),
        dataSchema: overwriteObject<NumberDataSchema>({t: DataSchemaType.Number}, resolvedDataSchema, {
          label: config.label,
        }),
      };

    case 'text':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.String);
      return {
        ...pick(config, 'type', 'key', 'label'),
        dataSchema: overwriteObject<StringDataSchema>({t: DataSchemaType.String}, resolvedDataSchema, {
          label: config.label,
        }),
      };

    case 'select':
      return parseSelectUISchemaConfig(config, context, resolvedDataSchema);

    case 'conditional': {
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Conditional);
      const conditionMap = createConditionMap(resolvedDataSchema, config);
      const contents = mapObjectToObject(config.conditionalContents, (childConfig, key) => {
        if (!conditionMap[key]) {
          throw new UISchemaParseError(`condition not found for key '${key}'`, context);
        }
        const schema = context.dataSchemaContext?.resolveRecursive(conditionMap[key].dataSchema);
        const nextContext = pushToContext(
          context,
          {key, type: 'conditional'},
          {key, type: schema?.t || DataSchemaType.FixedMap},
        );
        return parseConfigOrReference(childConfig, pathConfigMap, nextContext, schema);
      });
      return {
        ...pick(config, 'type', 'key', 'label'),
        contents,
        dataSchema: resolvedDataSchema!, // TODO
      };
    }

    case 'form': {
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.FixedMap);
      const {contents, dataSchema: childDataSchema} = parseChildrenDataSchema(
        config.contents,
        pathConfigMap,
        context,
        resolvedDataSchema,
      );
      return {
        ...pick(config, 'type', 'label'),
        ...copyKeyOrKeyFlatten(config),
        contents,
        dataSchema: childDataSchema,
      };
    }

    case 'tab': {
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.FixedMap);
      const {contents, dataSchema: childDataSchema} = parseChildrenDataSchema(
        config.contents,
        pathConfigMap,
        context,
        resolvedDataSchema,
      );
      return {
        ...pick(config, 'type', 'label'),
        ...copyKeyOrKeyFlatten(config),
        contents,
        dataSchema: childDataSchema,
      };
    }

    case 'contentList': {
      assertDataSchemaType(resolvedDataSchema, context, [DataSchemaType.Map, DataSchemaType.List]);
      return parseContentListUISchemaConfig(config, pathConfigMap, context, resolvedDataSchema);
    }

    case 'table': {
      assertDataSchemaType(resolvedDataSchema, context, [DataSchemaType.Map, DataSchemaType.List]);
      const childResolvedDataSchema = context.dataSchemaContext?.resolveRecursive(resolvedDataSchema?.item);
      assertDataSchemaType(childResolvedDataSchema, context, DataSchemaType.FixedMap);
      return parseTableUISchemaConfig(config, pathConfigMap, context, resolvedDataSchema, childResolvedDataSchema);
    }

    case 'mappingTable': {
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Map);
      const childResolvedDataSchema = context.dataSchemaContext?.resolveRecursive(resolvedDataSchema?.item);
      assertDataSchemaType(childResolvedDataSchema, context, DataSchemaType.FixedMap);
      return parseMappingTableUISchemaConfig(
        config,
        pathConfigMap,
        context,
        resolvedDataSchema,
        childResolvedDataSchema,
      );
    }
  }
}

function parseConfigOrReference(
  configOrReference: UISchemaConfig | string,
  pathConfigMap: PathConfigMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: DataSchema | undefined,
): UISchema {
  const resolved = resolveConfigOrRecursive(configOrReference, pathConfigMap, context.filePath, context.loadedPath);
  if (resolved.type === 'recursive') {
    throw new Error('Not implemented'); // TODO
    // return {type: 'recursive', depth: resolved.depth, dataSchema:};
  } else {
    const nextContext = setFilePathToContext(context, resolved.loadedPath, resolved.filePath);
    return parseUISchemaConfig2(resolved.config, pathConfigMap, nextContext, dataSchema);
  }
}

export async function buildUISchema(
  rootSchemaConfig: RootSchemaConfig,
  rootDataSchema: DataSchemaExcludeRecursive,
  storage: DataStorage,
  formatter: DataFormatter,
): Promise<UISchema> {
  type InternalSchema = NamedItemNode<UISchemaConfig>;
  const rootUiSchemaConfig = 'uiSchema' in rootSchemaConfig ? rootSchemaConfig.uiSchema : rootSchemaConfig.uiRoot;
  const namedUiSchemaConfig: InternalSchema = {filePath: []};
  const loadedUISchemaConfig = new Map<string, InternalSchema>([['', namedUiSchemaConfig]]);
  await loadNestedConfigFile(
    rootSchemaConfig.namedUiSchema || {},
    namedUiSchemaConfig,
    loadedUISchemaConfig,
    (config) => config,
    (schema) => schema,
    storage,
    formatter,
  );
  const context = createRootUiSchemaParsingContext(rootDataSchema);
  return parseUISchemaConfig2(rootUiSchemaConfig, loadedUISchemaConfig, context, rootDataSchema);
}

// TODO
// export function uiSchemaHasFlattenDataPathComponent(
//   schema: UISchema,
//   pathComponent: ForwardDataPathComponent,
//   manager: NamedUISchemaManager,
// ): boolean {
//   const resolved = manager.resolve(schema);
//   switch (resolved.type) {
//     case 'form':
//     case 'tab': {
//       if (resolved.keyFlatten) {
//         return resolved.contents.some((content) =>
//           uiSchemaHasFlattenDataPathComponent(content, pathComponent, manager),
//         );
//       }
//     }
//   }
//   return uiSchemaKeyAndPathComponentIsMatch(resolved.key, pathComponent);
// }

export function uiSchemaKeyAndPathComponentIsMatch(
  key: string | KeySymbolType | undefined,
  pathComponent: ForwardDataPathComponent,
): boolean {
  if (key === undefined) {
    return false;
  }
  if (dataPathComponentIsKey(pathComponent)) {
    return key === keySymbol;
  } else if (dataPathComponentIsMapKeyLike(pathComponent)) {
    return key === dataPathComponentToMapKey(pathComponent);
  } else {
    return false;
  }
}
