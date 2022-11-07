import {DataModel, MapDataModel} from './DataModelTypes';
import {
  DataPath,
  DataPathComponent,
  dataPathComponentIsIndexOrKey,
  dataPathComponentIsKey,
  dataPathComponentIsListIndex,
  dataPathComponentIsMapKey,
  dataPathComponentIsPointer,
  dataPathComponentToListIndex,
  dataPathComponentToMapKey,
  DataPathComponentType,
  dataPathConsecutiveReverseCount,
  dataPathLength,
  ForwardDataPath,
  ForwardDataPathComponent,
  headDataPathComponent,
  KeyPathComponent,
  MapKeyDataPathComponent,
  MultiDataPath,
  MultiDataPathComponent,
  shiftDataPath,
  unshiftDataPath,
} from './DataPath';
import {
  dataModelIsInteger,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsMapOrList,
  dataModelIsString,
  findMapDataIndexOfKey,
  getListDataAt,
  getListDataIndexForPointer,
  getMapDataAtIndex,
  getMapDataIndexForPointer,
  getMapKeyAtIndex,
  mapDataModelKeyIndexMap,
  mapListDataModel,
  mapMapDataModel,
  mapOrListDataModelIsList,
  numberDataModelToNumber,
  stringDataModelToString,
  stringToDataModel,
} from './DataModel';
import {DataSchema, DataSchemaContextKeyItem} from './DataSchema';
import {
  DataModelContext,
  DataModelContextMapPathComponent,
  DataModelContextPathComponent,
  DataModelRoot,
  getCurrentKeyOrUndefinedFromDataModelContext,
  getDataModelByDataModelContext,
  popDataModelContextPath,
  pushDataModelContextPath,
  pushKeyToDataModelContextPath,
} from './DataModelContext';

interface CollectOrigin {
  readonly path: ForwardDataPath;
  readonly model: DataModel | undefined;
  contextKeys?: readonly DataSchemaContextKeyItem[];
}

export interface CollectDataModelGlobal {
  readonly rootModel: DataModel;
  readonly rootSchema: DataSchema;
  readonly contextKeys?: readonly DataSchemaContextKeyItem[];
}

interface CollectDataModelContext extends CollectDataModelGlobal {
  readonly currentModel: DataModel | undefined;
  readonly currentPath: ForwardDataPath;
}

interface DigCallbacks<Return, PathComponent extends MultiDataPathComponent> {
  key: () => Return;
  collection: (model: DataModel, contextPathComponent: DataModelContextPathComponent) => Return;
  other: (pathComponent: Exclude<PathComponent, ForwardDataPathComponent | KeyPathComponent>) => Return;
}

function mapKeyDataPathComponentToContextPathComponent(
  data: MapDataModel,
  pathComponent: MapKeyDataPathComponent,
): DataModelContextMapPathComponent | undefined {
  const mapKey = dataPathComponentToMapKey(pathComponent);
  const indexCache = findMapDataIndexOfKey(data, mapKey);
  return indexCache === undefined ? undefined : {type: 'map', at: mapKey, indexCache};
}

/**
 * rootDataModelを利用して
 *
 * TODO DataModelContextにdataがあるが、これは古いデータである可能性があるので、利用できない。DataModelContextのdataプロパティを無くす方向で検討
 * @param context
 * @param count
 * @param rootDataModel
 */
export function getAncestorDataModel(
  context: DataModelContext,
  count: number,
  rootDataModel: DataModel,
): DataModel | undefined {
  const ancestorContext = popDataModelContextPath(context, count);
  return getDataModelByDataModelContext(ancestorContext, rootDataModel);
}

export function digForPathComponent<Return, PathComponent extends MultiDataPathComponent>(
  model: DataModel | undefined,
  pathComponent: PathComponent,
  callbacks: DigCallbacks<Return, PathComponent>,
): Return | undefined {
  if (dataPathComponentIsKey(pathComponent)) {
    return callbacks.key();
  } else if (dataPathComponentIsMapKey(pathComponent)) {
    if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(pathComponent);
      const indexCache = findMapDataIndexOfKey(model, mapKey);
      if (indexCache === undefined) {
        return undefined;
      }
      const childData = getMapDataAtIndex(model, indexCache);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'map', at: mapKey, indexCache});
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    if (!dataModelIsList(model)) {
      return undefined;
    }
    const listIndex = dataPathComponentToListIndex(pathComponent);
    const childData = getListDataAt(model, listIndex);
    if (childData === undefined) {
      return undefined;
    }
    return callbacks.collection(childData, {type: 'list', at: listIndex});
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    if (dataModelIsList(model)) {
      const listIndex = dataPathComponentToListIndex(pathComponent);
      const childData = getListDataAt(model, listIndex);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'list', at: listIndex});
    } else if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(pathComponent);
      const indexCache = findMapDataIndexOfKey(model, mapKey);
      if (indexCache === undefined) {
        return undefined;
      }
      const childData = getMapDataAtIndex(model, indexCache);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'map', at: mapKey, indexCache});
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsPointer(pathComponent)) {
    if (dataModelIsList(model)) {
      const listIndex = getListDataIndexForPointer(model, pathComponent);
      if (listIndex === undefined) {
        return undefined;
      }
      const childData = getListDataAt(model, listIndex);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'list', at: listIndex});
    } else if (dataModelIsMap(model)) {
      const indexCache = getMapDataIndexForPointer(model, pathComponent);
      if (indexCache === undefined) {
        return undefined;
      }
      const mapKey = getMapKeyAtIndex(model, indexCache);
      if (mapKey === undefined || mapKey === null) {
        return undefined;
      }
      const childData = getMapDataAtIndex(model, indexCache);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'map', at: mapKey, indexCache});
    } else {
      return undefined;
    }
  } else {
    // Genericsを使うとうまく Type Guard が効かないので、仕方なく Type Assertion を使う。
    return callbacks.other(pathComponent as Exclude<PathComponent, ForwardDataPathComponent | KeyPathComponent>);
  }
}

function getDataModelBySinglePathImpl(
  model: DataModel | undefined,
  path: DataPath,
  currentContext: DataModelContext,
  originalContext: DataModelContext,
  originalModel: DataModel | undefined,
  dataRoot: DataModelRoot,
): DataModel | undefined {
  if (dataPathLength(path) === 0) {
    return model;
  }

  const head = headDataPathComponent(path);
  return digForPathComponent<DataModel | undefined, DataPathComponent>(model, head, {
    key: () => {
      const key = getCurrentKeyOrUndefinedFromDataModelContext(currentContext);
      return key === undefined ? undefined : stringToDataModel(key);
    },
    collection: (childData: DataModel, contextPathComponent: DataModelContextPathComponent): DataModel | undefined => {
      return getDataModelBySinglePathImpl(
        childData,
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, contextPathComponent),
        originalContext,
        originalModel,
        dataRoot,
      );
    },
    other: (otherPathComponent): DataModel | undefined => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.Reverse: {
          const reverseCount = dataPathConsecutiveReverseCount(path);
          return getDataModelBySinglePathImpl(
            getAncestorDataModel(currentContext, reverseCount, dataRoot.model),
            shiftDataPath(path, reverseCount),
            popDataModelContextPath(currentContext, reverseCount),
            originalContext,
            originalModel,
            dataRoot,
          );
        }
        case DataPathComponentType.ContextKey:
          // TODO
          return undefined;
        case DataPathComponentType.Nested: {
          if (dataModelIsMapOrList(model)) {
            const nested = getDataModelBySinglePath(originalModel, otherPathComponent.v, originalContext, dataRoot);
            if (mapOrListDataModelIsList(model)) {
              if (!dataModelIsInteger(nested)) {
                return undefined;
              }
              const index = numberDataModelToNumber(nested);
              return getDataModelBySinglePathImpl(
                getListDataAt(model, index),
                shiftDataPath(path),
                pushDataModelContextPath(currentContext, {type: 'list', at: index}),
                originalContext,
                originalModel,
                dataRoot,
              );
            } else {
              if (!dataModelIsString(nested)) {
                return undefined;
              }
              const key = stringDataModelToString(nested);
              const index = findMapDataIndexOfKey(model, key);
              if (index === undefined) {
                return undefined;
              }
              return getDataModelBySinglePathImpl(
                getMapDataAtIndex(model, index),
                shiftDataPath(path),
                pushDataModelContextPath(currentContext, {type: 'map', at: key, indexCache: index}),
                originalContext,
                originalModel,
                dataRoot,
              );
            }
          } else {
            return undefined;
          }
        }
      }
    },
  });
}

export function getDataModelBySinglePath(
  model: DataModel | undefined,
  path: DataPath,
  context: DataModelContext,
  dataRoot: DataModelRoot,
): DataModel | undefined {
  if (path.isAbsolute) {
    return getDataModelBySinglePathImpl(dataRoot.model, path, context, context, model, dataRoot);
  } else {
    return getDataModelBySinglePathImpl(model, path, context, context, model, dataRoot);
  }
}

export function getDataModelByForwardPath(model: DataModel | undefined, path: ForwardDataPath): DataModel | undefined {
  if (!model) {
    return undefined;
  }
  if (dataPathLength(path) === 0) {
    return model;
  }
  const head = headDataPathComponent(path);
  return digForPathComponent<DataModel | undefined, ForwardDataPathComponent>(model, head, {
    key: () => undefined,
    collection: (childData: DataModel) => getDataModelByForwardPath(childData, shiftDataPath(path)),
    other: () => undefined,
  });
}

export interface DataModelCollectionItem {
  readonly data: DataModel;
  readonly context: DataModelContext;
}

export function* withNestedDataPath(
  model: DataModel | undefined,
  path: MultiDataPath,
  context: DataModelContext,
  root: DataModelRoot,
): Generator<[DataModel | undefined, DataModelContext], void> {
  if (dataModelIsMapOrList(model)) {
    const nestedValues = collectDataModel(model, path, context, root);
    if (mapOrListDataModelIsList(model)) {
      for (const {data} of nestedValues) {
        if (!dataModelIsInteger(data)) {
          continue;
        }
        const index = numberDataModelToNumber(data);
        yield [getListDataAt(model, index), pushDataModelContextPath(context, {type: 'list', at: index})];
      }
    } else {
      const keyIndexMap = mapDataModelKeyIndexMap(model);
      for (const {data} of nestedValues) {
        if (!dataModelIsString(data)) {
          continue;
        }
        const key = stringDataModelToString(data);
        const index = keyIndexMap.get(key);
        if (index === undefined) {
          continue;
        }
        yield [
          getMapDataAtIndex(model, index),
          pushDataModelContextPath(context, {type: 'map', at: key, indexCache: index}),
        ];
      }
    }
  }
}

function collectDataModelImpl(
  model: DataModel | undefined,
  path: MultiDataPath,
  currentContext: DataModelContext,
  originalContext: DataModelContext,
  originalModel: DataModel | undefined,
  root: DataModelRoot,
): DataModelCollectionItem[] {
  if (dataPathLength(path) === 0) {
    return model === undefined ? [] : [{data: model, context: currentContext}];
  }
  const head = headDataPathComponent(path);
  const result = digForPathComponent<DataModelCollectionItem[], MultiDataPathComponent>(model, head, {
    key: () => {
      const key = getCurrentKeyOrUndefinedFromDataModelContext(currentContext);
      return key === undefined
        ? []
        : [{data: stringToDataModel(key), context: pushKeyToDataModelContextPath(currentContext)}];
    },
    collection: (childData, contextPathComponent) =>
      collectDataModelImpl(
        childData,
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, contextPathComponent),
        originalContext,
        originalModel,
        root,
      ),
    other: (otherPathComponent): DataModelCollectionItem[] => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.WildCard:
          if (dataModelIsMap(model)) {
            return mapMapDataModel(model, (value, key, index) => {
              return key === null
                ? []
                : collectDataModelImpl(
                    getMapDataAtIndex(model, index),
                    shiftDataPath(path),
                    pushDataModelContextPath(currentContext, {type: 'map', at: key, indexCache: index}),
                    originalContext,
                    originalModel,
                    root,
                  );
            }).flat();
          } else if (dataModelIsList(model)) {
            return mapListDataModel(model, (value, index) => {
              return collectDataModelImpl(
                getListDataAt(model, index),
                shiftDataPath(path),
                pushDataModelContextPath(currentContext, {type: 'list', at: index}),
                originalContext,
                originalModel,
                root,
              );
            }).flat();
          } else {
            return [];
          }
        case DataPathComponentType.Nested:
          if (dataModelIsMapOrList(model)) {
            const nestedValues = collectDataModel(originalModel, otherPathComponent.v, originalContext, root);
            if (mapOrListDataModelIsList(model)) {
              return nestedValues.flatMap(({data}) => {
                if (!dataModelIsInteger(data)) {
                  return [];
                }
                const index = numberDataModelToNumber(data);
                return collectDataModelImpl(
                  getListDataAt(model, index),
                  shiftDataPath(path),
                  pushDataModelContextPath(currentContext, {type: 'list', at: index}),
                  originalContext,
                  originalModel,
                  root,
                );
              });
            } else {
              return nestedValues.flatMap(({data}) => {
                if (!dataModelIsString(data)) {
                  return [];
                }
                const key = stringDataModelToString(data);
                const index = findMapDataIndexOfKey(model, key);
                if (index === undefined) {
                  return [];
                }
                return collectDataModelImpl(
                  getMapDataAtIndex(model, index),
                  shiftDataPath(path),
                  pushDataModelContextPath(currentContext, {type: 'map', at: key, indexCache: index}),
                  originalContext,
                  originalModel,
                  root,
                );
              });
            }
          } else {
            return [];
          }
        case DataPathComponentType.Reverse: {
          const reverseCount = dataPathConsecutiveReverseCount(path);
          return collectDataModelImpl(
            getAncestorDataModel(currentContext, reverseCount, root.model),
            shiftDataPath(path, reverseCount),
            popDataModelContextPath(currentContext, reverseCount),
            originalContext,
            originalModel,
            root,
          );
        }
        case DataPathComponentType.ContextKey:
          // TODO DataModelContextにスキーマをもたせてから
          return [];
        case DataPathComponentType.Union:
          return otherPathComponent.v.flatMap((pathComponent) => {
            return collectDataModelImpl(
              model,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              originalContext,
              originalModel,
              root,
            );
          });
      }
    },
  });
  return result ?? [];
}

export function collectDataModel(
  model: DataModel | undefined,
  path: MultiDataPath,
  context: DataModelContext,
  root: DataModelRoot,
): DataModelCollectionItem[] {
  if (path.isAbsolute) {
    return collectDataModelImpl(root.model, path, context, context, model, root);
  } else {
    return collectDataModelImpl(model, path, context, context, model, root);
  }
}
