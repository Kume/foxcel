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
  MappingTableUISchemaConfig,
  parsePath,
  RootSchemaConfig,
  SelectUISchemaConfig,
  TableUISchemaConfig,
  UISchemaConfig,
  UISchemaConfigOrReference,
  UISchemaReference,
} from '..';
import pick from 'lodash.pick';
import {mapObjectToObject, mapToObject} from '../common/utils';
import DataStorage from '../Storage/DataStorage';
import {DataFormatter} from '../Storage/DataFormatter';
import {FilePathConfigNamedItemMap, WritableFileBaseNamedItemNode} from '../common/commonTypes';
import {loadNestedConfigFile} from '../Storage/utils';
import {LoadedSchemaPath, parseSchemaReferenceConfig, resolveConfigOrRecursive} from '../common/schemaCommon';
import {
  BooleanDataSchema,
  ConditionalDataSchema,
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
import {UISchemaContext} from './UISchemaContext';
import {
  ContentListUISchema,
  FlattenableUISchemaCommon,
  FormUISchema,
  MappingTableUISchema,
  RecursiveUISchema,
  SelectUISchema,
  TableUISchema,
  TabUISchema,
  UISchema,
  UISchemaOrRecursive,
} from './UISchemaTypes';

export type UISchemaExcludeRecursive<E = UISchemaOrRecursive> = E extends RecursiveUISchema ? never : E;

export type UISchemaType = UISchemaOrRecursive['type'];

/**
 * trueは$keyを表す
 */
export type UISchemaKey = string | true;

export interface UISchemaParsingContext {
  readonly uiPath: ReadonlyArray<{key?: string; type: UISchemaType}>;
  // readonly dataPath: ReadonlyArray<{key: string | number | null; type: DataSchemaType}> | undefined;
  readonly dataSchemaContext: DataSchemaContext;
  readonly loadedPath: LoadedSchemaPath<DataSchema>;
  readonly filePath: readonly string[];
}

export const createRootUiSchemaParsingContext = (
  dataSchema: DataSchemaExcludeRecursive | undefined,
): UISchemaParsingContext => ({
  uiPath: [],
  // dataPath: [],
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
  data: {key: UISchemaKey | number | null; type: DataSchemaType} | undefined,
): UISchemaParsingContext {
  return {
    ...context,
    uiPath: ui ? [...context.uiPath, ui] : context.uiPath,
    dataSchemaContext: context?.dataSchemaContext?.dig(data?.key === true ? {t: 'key'} : data?.key),
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
  return Boolean(config.keyFlatten);
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
  return undefined;
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
      ...pick(config, 'type', 'label', 'emptyToNull'),
      key: parseKey(config.key),
      isMulti: true,
      dataSchema: overwriteObject<ListDataSchema>(dataSchema, {t: DataSchemaType.List, label: config.label}),
      options,
    };
  } else {
    assertDataSchemaType(dataSchema, context, [DataSchemaType.String, DataSchemaType.Number]);
    const options = optionsFromDataSchema(dataSchema, context) || (config.options && parseOptionConfig(config.options));
    if (!options) {
      throw new UISchemaParseError('options config not found.', context);
    }
    return {
      ...pick(config, 'type', 'label'),
      key: parseKey(config.key),
      isMulti: false,
      dataSchema: overwriteObject<StringDataSchema | NumberDataSchema>(dataSchema, {label: config.label}),
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

function isFlattenableUISchema(schema: UISchemaOrRecursive): schema is FormUISchema | TabUISchema {
  return schema.type === 'form' || schema.type === 'tab';
}

function makeKeyFlattenable(
  config: KeyOrKeyFlatten,
  contents: readonly UISchemaOrRecursive[],
): FlattenableUISchemaCommon & {key?: UISchemaKey} {
  if (config.keyFlatten) {
    const flatKeys: Map<UISchemaKey, UISchemaKey[]> = new Map();
    if (contents.length === 0) {
      throw new Error('key flatten config must have contents'); // TODO
    }
    const firstContent = contents[0];
    if (firstContent.type === 'recursive') {
      throw new Error('flatten config cannot have recursive content'); // TODO
    }
    if (!firstContent.key) {
      throw new Error('flatten content must have key'); // TODO
    }
    const firstContentKey = firstContent.key;
    for (const content of contents) {
      if (isFlattenableUISchema(content) && content.keyFlatten) {
        content.flatKeys.forEach((keyPath, key) => {
          flatKeys.set(key, [firstContentKey, ...keyPath]);
        });
      } else {
        if (content.type !== 'recursive') {
          if (!content.key) {
            throw new Error('flatten content must have key'); // TODO
          }
          flatKeys.set(content.key, [content.key]);
        }
      }
    }
    return {keyFlatten: true, key: firstContentKey, flatKeys};
  } else {
    return {key: parseKey(config.key)};
  }
}

function parseKey(key: string): string;
function parseKey(key: string | undefined): string | undefined;
function parseKey(key: string, enableParentKey: true): UISchemaKey;
function parseKey(key: string | undefined, enableParentKey: true): UISchemaKey | undefined;
function parseKey(key: string | undefined, enableParentKey?: boolean): UISchemaKey | undefined {
  if (key === undefined) {
    return undefined;
  }
  if (key === '$key') {
    if (enableParentKey) {
      return true;
    } else {
      // TODO 正しくハンドリング
      throw new Error('$key is disabled for the schema');
    }
  }
  return key;
}

function parseContentListUISchemaConfig(
  config: ContentListUISchemaConfig,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | ListDataSchema | undefined,
): ContentListUISchema {
  const key = parseKey(config.key) || null;
  const nextContext = pushToContext(context, {type: config.type}, dataSchema && {key, type: dataSchema.t});
  const content = parseConfigOrReference(
    config.content,
    pathConfigMap,
    nextContext,
    nextContext.dataSchemaContext?.resolveRecursive(dataSchema?.item),
  );
  if (content.dataSchema?.t === DataSchemaType.Key) {
    throw new Error('ContentListの要素としてkeyに$keyを持つ要素を直接持つことはできません。');
  }
  return {
    ...pick(config, 'type', 'label'),
    key: parseKey(config.key),
    dataSchema: overwriteObject<MapDataSchema | ListDataSchema>(
      {t: collectionTypeToDataSchemaType(config.dataType || 'list')},
      dataSchema,
      {item: content.dataSchema, label: config.label},
    ),
    content,
  };
}

export function getUiSchemaUniqueKeyOrUndefined(schema: UISchemaOrRecursive): string | undefined {
  return schema.key === true ? undefined : schema.key;
}

function parseChildrenDataSchema(
  contentsConfig: ReadonlyArray<UISchemaConfigOrReference>,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  childDataSchema: FixedMapDataSchema | undefined,
): {dataSchema: FixedMapDataSchema; contents: readonly UISchemaOrRecursive[]} {
  const contents = contentsConfig.map((rowConfig) => {
    const [cellContext, cellDataSchema] = nextChildDataSchema(rowConfig, pathConfigMap, childDataSchema, context);
    return parseConfigOrReference(rowConfig, pathConfigMap, cellContext, cellDataSchema);
  });
  const contentsByKey = new Map<string, UISchemaOrRecursive>(
    contents
      .map((content) => [getUiSchemaUniqueKeyOrUndefined(content) || '', content] as const)
      .filter(([key]) => key),
  );
  const itemKeys = [...new Set([...Object.keys(childDataSchema?.items || {}), ...contentsByKey.keys()])];
  const dataSchema = overwriteObject<FixedMapDataSchema>({t: DataSchemaType.FixedMap}, childDataSchema, {
    items: mapToObject(
      itemKeys,
      (key) => {
        const dataSchema = contentsByKey.get(key)?.dataSchema;
        if (dataSchema?.t === DataSchemaType.Key) {
          return [key, undefined];
        } else {
          return [key, dataSchema || childDataSchema?.items?.[key]];
        }
      },
      true,
    ),
  });
  return {dataSchema, contents};
}

function parseTableUISchemaConfig(
  config: TableUISchemaConfig,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | ListDataSchema | undefined,
  rowDataSchema: FixedMapDataSchema | undefined,
): TableUISchema {
  const rowContext = pushToContext(
    context,
    {type: config.type},
    dataSchema && {key: parseKey(config.key) || null, type: dataSchema.t},
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
  return {...pick(config, 'type', 'label'), key: parseKey(config.key), dataSchema: fixedDataSchema, contents};
}

function parseMappingTableUISchemaConfig(
  config: MappingTableUISchemaConfig,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: MapDataSchema | undefined,
  rowDataSchema: FixedMapDataSchema | undefined,
): MappingTableUISchema {
  const rowContext = pushToContext(
    context,
    {type: config.type},
    dataSchema && {key: parseKey(config.key) || null, type: dataSchema.t},
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
    ...pick(config, 'type', 'label'),
    key: parseKey(config.key),
    sourcePath: parsePath(config.sourcePath, 'single'),
    contents,
    dataSchema: fixedSchema,
  };
}

function nextChildDataSchema(
  configOrReference: UISchemaConfigOrReference,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  dataSchema: FixedMapDataSchema | undefined,
  context: UISchemaParsingContext,
): [UISchemaParsingContext, DataSchema | undefined] {
  const resolved = resolveConfigOrRecursive(
    configOrReference,
    uiSchemaConfigIsReference,
    ({ref}) => parseSchemaReferenceConfig(ref),
    pathConfigMap,
    context.filePath,
    context.loadedPath,
    dataSchema,
  );
  if (resolved.type === 'recursive') {
    // TODO childrenはハードコーディングではいけない
    const childDataSchema =
      dataSchema && context.dataSchemaContext?.resolveRecursive(getByKeyForFixedMapDataSchema(dataSchema, 'children'));
    const dataPathComponent = childDataSchema && {key: 'children', type: childDataSchema.t};
    // TODO pushで良い？遡らないといけなくはない？ => スキーマ時点だとそんなことは無い気がするが…
    return [pushToContext(context, undefined, dataPathComponent), childDataSchema];
    // TODO dataSchemaをdepth分遡る必要がある。そのためには、引数にデータスキーマのコンテキストが必要
    throw new Error('Not implemented');
    // return [pushToContext(), result.additionalPathInfo];
  } else {
    if (isKeyFlatten(resolved.config)) {
      return [context, dataSchema];
    } else {
      let dataPathComponent: {key: string; type: DataSchemaType} | undefined;
      let childDataSchema: DataSchema | undefined;
      if (!resolved.config.key) {
        throw new Error('key is undefined');
      }
      if (dataSchema) {
        const key = parseKey(resolved.config.key, true);
        if (typeof key === 'string') {
          childDataSchema = context.dataSchemaContext?.resolveRecursive(getByKeyForFixedMapDataSchema(dataSchema, key));
          dataPathComponent = childDataSchema && {key, type: childDataSchema.t};
        }
        // TODO else節が不要か考える
      }
      return [pushToContext(context, undefined, dataPathComponent), childDataSchema];
    }
  }
}

export function parseUISchemaConfig(
  config: UISchemaConfig,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: DataSchema | undefined,
): UISchemaExcludeRecursive {
  const resolvedDataSchema = context.dataSchemaContext?.resolveRecursive(dataSchema);
  switch (config.type) {
    case 'checkbox':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Boolean);
      return {
        ...pick(config, 'type', 'label'),
        key: parseKey(config.key),
        dataSchema: overwriteObject<BooleanDataSchema>({t: DataSchemaType.Boolean}, resolvedDataSchema, {
          label: config.label,
        }),
      };

    case 'number':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.Number);
      return {
        ...pick(config, 'type', 'label'),
        key: parseKey(config.key),
        dataSchema: overwriteObject<NumberDataSchema>({t: DataSchemaType.Number}, resolvedDataSchema, {
          label: config.label,
        }),
      };

    case 'text':
      assertDataSchemaType(resolvedDataSchema, context, DataSchemaType.String);
      return {
        ...pick(config, 'type', 'label'),
        key: parseKey(config.key, true),
        dataSchema: overwriteObject<StringDataSchema>({t: DataSchemaType.String}, resolvedDataSchema, {
          label: config.label,
        }),
        multiline: config.multiline,
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
        ...pick(config, 'type', 'label'),
        key: parseKey(config.key),
        contents,
        dataSchema: resolvedDataSchema!,
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
        type: 'form',
        label: config.label,
        ...makeKeyFlattenable(config, contents),
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
        type: 'tab',
        label: config.label,
        ...makeKeyFlattenable(config, contents),
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
  configOrReference: UISchemaConfigOrReference,
  pathConfigMap: FilePathConfigNamedItemMap<UISchemaConfig>,
  context: UISchemaParsingContext,
  dataSchema: DataSchema | undefined,
): UISchemaOrRecursive {
  const resolved = resolveConfigOrRecursive(
    configOrReference,
    uiSchemaConfigIsReference,
    ({ref}) => parseSchemaReferenceConfig(ref),
    pathConfigMap,
    context.filePath,
    context.loadedPath,
  );
  if (resolved.type === 'recursive') {
    return {type: 'recursive', depth: resolved.depth, key: resolved.ref.key};
  } else {
    const nextContext = setFilePathToContext(context, resolved.loadedPath, resolved.filePath);
    return parseUISchemaConfig(resolved.config, pathConfigMap, nextContext, dataSchema);
  }
}

export async function buildUISchema(
  rootSchemaConfig: RootSchemaConfig,
  rootDataSchema: DataSchemaExcludeRecursive,
  storage: DataStorage,
  formatter: DataFormatter,
): Promise<UISchema> {
  const rootUiSchemaConfig = 'uiSchema' in rootSchemaConfig ? rootSchemaConfig.uiSchema : rootSchemaConfig.uiRoot;
  const namedUiSchemaConfig: WritableFileBaseNamedItemNode<UISchemaConfig> = {filePath: []};
  const loadedUISchemaConfig = new Map([['', namedUiSchemaConfig]]);
  await loadNestedConfigFile(
    rootSchemaConfig.namedUiSchema || {},
    namedUiSchemaConfig,
    loadedUISchemaConfig,
    (config) => config,
    storage,
    formatter,
  );
  const context = createRootUiSchemaParsingContext(rootDataSchema);
  return parseUISchemaConfig(rootUiSchemaConfig, loadedUISchemaConfig, context, rootDataSchema);
}

export function buildSimpleUISchema(
  rootSchemaConfig: RootSchemaConfig,
  rootDataSchema: DataSchemaExcludeRecursive,
): UISchemaExcludeRecursive {
  const rootUiSchemaConfig = 'uiSchema' in rootSchemaConfig ? rootSchemaConfig.uiSchema : rootSchemaConfig.uiRoot;
  const namedUiSchemaConfig: WritableFileBaseNamedItemNode<UISchemaConfig> = {filePath: []};
  const loadedUISchemaConfig = new Map([['', namedUiSchemaConfig]]);
  const context = createRootUiSchemaParsingContext(rootDataSchema);
  return parseUISchemaConfig(rootUiSchemaConfig, loadedUISchemaConfig, context, rootDataSchema);
}

export function uiSchemaHasFlattenDataPathComponent(
  schema: UISchemaOrRecursive,
  pathComponent: ForwardDataPathComponent,
  context: UISchemaContext,
): boolean {
  const resolved = context.resolve(schema);
  switch (resolved.type) {
    case 'form':
    case 'tab': {
      if (resolved.keyFlatten) {
        return resolved.contents.some((content) =>
          uiSchemaHasFlattenDataPathComponent(content, pathComponent, context),
        );
      }
    }
  }
  return uiSchemaKeyAndPathComponentIsMatch(resolved.key, pathComponent);
}

export function uiSchemaKeyAndPathComponentIsMatch(
  key: UISchemaKey | undefined,
  pathComponent: ForwardDataPathComponent,
): boolean {
  if (key === undefined) {
    return false;
  }
  if (dataPathComponentIsKey(pathComponent)) {
    return key === true;
  } else if (dataPathComponentIsMapKeyLike(pathComponent)) {
    return key === dataPathComponentToMapKey(pathComponent);
  } else {
    return false;
  }
}

export function stringUISchemaKeyToString(key: string): string;
export function stringUISchemaKeyToString(key: string | undefined): string | undefined;
export function stringUISchemaKeyToString(key: string | undefined): string | undefined {
  return key;
}

export function uiSchemaKeyIsParentKey(key: UISchemaKey | undefined): key is true {
  return key === true;
}

function uiSchemaConfigIsReference(
  configOrReference: UISchemaConfigOrReference,
): configOrReference is UISchemaReference {
  return configOrReference.type === 'ref';
}
