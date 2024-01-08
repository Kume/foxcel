import {DataModel} from './DataModelTypes';
import {
  AnyDataPathComponent,
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
  dataPathLength,
  EditingForwardDataPath,
  EditingForwardDataPathComponent,
  headDataPathComponent,
  KeyPathComponent,
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
  getListDataAt,
  getListDataIndexForPointer,
  getListItemAt,
  getMapDataAtIndex,
  getMapDataIndexAt,
  getMapDataIndexForPointer,
  getMapItemAt,
  getMapItemAtIndex,
  mapDataModelKeyIndexMap,
  mapListDataModel,
  mapMapDataModel,
  mapOrListDataModelIsList,
  numberDataModelToNumber,
  stringDataModelToString,
  stringToDataModel,
} from './DataModel';
import {DataSchema, DataSchemaContextKeyItem} from './DataSchema';
import {DataModelContext, dataModelForPathStart, DataModelRoot} from './DataModelContext';

export interface CollectDataModelGlobal {
  readonly rootModel: DataModel;
  readonly rootSchema: DataSchema;
  readonly contextKeys?: readonly DataSchemaContextKeyItem[];
}

interface DigCallbacks<Return, PathComponent extends AnyDataPathComponent> {
  key: () => Return;
  collection: (model: DataModel, pushContext: (parentContext: DataModelContext) => DataModelContext) => Return;
  other: (pathComponent: Exclude<PathComponent, EditingForwardDataPathComponent | KeyPathComponent>) => Return;
}

export function digForPathComponent<Return, PathComponent extends AnyDataPathComponent>(
  model: DataModel | undefined,
  pathComponent: PathComponent,
  callbacks: DigCallbacks<Return, PathComponent>,
): Return | undefined {
  if (dataPathComponentIsKey(pathComponent)) {
    return callbacks.key();
  } else if (dataPathComponentIsMapKey(pathComponent)) {
    if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(pathComponent);

      const item = getMapItemAt(model, mapKey);
      if (!item) {
        return undefined;
      }
      const [childData, , , index] = item;
      return callbacks.collection(childData, (dataContext) => dataContext.pushMapIndex(index, mapKey));
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    if (!dataModelIsList(model)) {
      return undefined;
    }
    const index = dataPathComponentToListIndex(pathComponent);
    const childData = getListDataAt(model, index);
    if (childData === undefined) {
      return undefined;
    }
    return callbacks.collection(childData, (dataContext) => dataContext.pushListIndex(index));
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    if (dataModelIsList(model)) {
      const listIndex = dataPathComponentToListIndex(pathComponent);
      const childItem = getListItemAt(model, listIndex);
      if (!childItem) {
        return undefined;
      }
      const [childData, , index] = childItem;
      return callbacks.collection(childData, (dataContext) => dataContext.pushListIndex(index));
    } else if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(pathComponent);
      const item = getMapItemAt(model, mapKey);
      if (!item) {
        return undefined;
      }
      const [childData, , , index] = item;
      return callbacks.collection(childData, (dataContext) => dataContext.pushMapIndex(index, mapKey));
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
      return callbacks.collection(childData, (context) => context.pushListIndex(listIndex));
    } else if (dataModelIsMap(model)) {
      const indexCache = getMapDataIndexForPointer(model, pathComponent);
      if (indexCache === undefined) {
        return undefined;
      }
      const item = getMapItemAtIndex(model, indexCache);
      if (!item) {
        return undefined;
      }
      const [childData, , key] = item;
      return callbacks.collection(childData, (context) => context.pushMapIndex(indexCache, key));
    } else {
      return undefined;
    }
  } else {
    // Genericsを使うとうまく Type Guard が効かないので、仕方なく Type Assertion を使う。
    return callbacks.other(pathComponent as Exclude<PathComponent, EditingForwardDataPathComponent | KeyPathComponent>);
  }
}

function getDataModelBySinglePathImpl(
  model: DataModel | undefined,
  // TODO componentsにすべきなきがする
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
      return currentContext.parentKeyDataModel;
    },
    collection: (childData: DataModel, pushContext): DataModel | undefined => {
      return getDataModelBySinglePathImpl(
        childData,
        shiftDataPath(path),
        pushContext(currentContext),
        originalContext,
        originalModel,
        dataRoot,
      );
    },
    other: (otherPathComponent): DataModel | undefined => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.Nested: {
          if (dataModelIsMapOrList(model)) {
            const nested = getDataModelBySinglePath(originalModel, otherPathComponent.v, originalContext, dataRoot);
            if (mapOrListDataModelIsList(model)) {
              if (!dataModelIsInteger(nested)) {
                return undefined;
              }
              const index = numberDataModelToNumber(nested);
              const childDate = getListDataAt(model, index);
              if (childDate === undefined) {
                return undefined;
              }
              return getDataModelBySinglePathImpl(
                childDate,
                shiftDataPath(path),
                currentContext.pushListIndex(index),
                originalContext,
                originalModel,
                dataRoot,
              );
            } else {
              if (!dataModelIsString(nested)) {
                return undefined;
              }
              const key = stringDataModelToString(nested);
              const index = getMapDataIndexAt(model, key);
              if (index === undefined) {
                return undefined;
              }
              return getDataModelBySinglePathImpl(
                getMapDataAtIndex(model, index),
                shiftDataPath(path),
                currentContext.pushMapIndex(index, key),
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
  const [start] = dataModelForPathStart(dataRoot, model, path, context);
  return getDataModelBySinglePathImpl(start, path, context, context, model, dataRoot);
}

export function getDataModelByForwardPath(
  model: DataModel | undefined,
  path: EditingForwardDataPath,
): DataModel | undefined {
  if (!model) {
    return undefined;
  }
  if (dataPathLength(path) === 0) {
    return model;
  }
  const head = headDataPathComponent(path);
  return digForPathComponent<DataModel | undefined, EditingForwardDataPathComponent>(model, head, {
    key: () => undefined,
    collection: (childData: DataModel) => getDataModelByForwardPath(childData, shiftDataPath(path)),
    other: () => undefined,
  });
}

export function getDataModelByEditingForwardPath(
  model: DataModel | undefined,
  path: EditingForwardDataPath,
): DataModel | undefined {
  if (!model) {
    return undefined;
  }
  if (dataPathLength(path) === 0) {
    return model;
  }
  const head = headDataPathComponent(path);
  return digForPathComponent<DataModel | undefined, EditingForwardDataPathComponent>(model, head, {
    key: () => undefined,
    collection: (childData: DataModel) => getDataModelByEditingForwardPath(childData, shiftDataPath(path)),
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
    const nestedValues = collectDataModel(path, model, context, root);
    if (mapOrListDataModelIsList(model)) {
      for (const {data} of nestedValues) {
        if (!dataModelIsInteger(data)) {
          continue;
        }
        const index = numberDataModelToNumber(data);
        yield [getListDataAt(model, index), context.pushListIndex(index)];
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
        yield [getMapDataAtIndex(model, index), context.pushMapIndex(index, key)];
      }
    }
  }
}

type CollectDataModelOrigin = readonly [model: DataModel | undefined, context: DataModelContext, root: DataModelRoot];

function collectDataModelImpl(
  model: DataModel | undefined,
  path: MultiDataPath,
  currentContext: DataModelContext,
  origin: CollectDataModelOrigin,
): DataModelCollectionItem[] {
  if (dataPathLength(path) === 0) {
    return model === undefined ? [] : [{data: model, context: currentContext}];
  }
  const head = headDataPathComponent(path);
  const result = digForPathComponent<DataModelCollectionItem[], MultiDataPathComponent>(model, head, {
    key: () => {
      const key = currentContext.parentKeyDataModel;
      return key === undefined ? [] : [{data: stringToDataModel(key), context: currentContext.pushIsParentKey()}];
    },
    collection: (childData, pushContext) =>
      collectDataModelImpl(childData, shiftDataPath(path), pushContext(currentContext), origin),
    other: (otherPathComponent): DataModelCollectionItem[] => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.WildCard:
          if (dataModelIsMap(model)) {
            return mapMapDataModel(model, (value, key, index) => {
              return key === null
                ? []
                : collectDataModelImpl(value, shiftDataPath(path), currentContext.pushMapIndex(index, key), origin);
            }).flat();
          } else if (dataModelIsList(model)) {
            return mapListDataModel(model, (value, index) => {
              return collectDataModelImpl(value, shiftDataPath(path), currentContext.pushListIndex(index), origin);
            }).flat();
          } else {
            return [];
          }
        case DataPathComponentType.Nested:
          if (dataModelIsMapOrList(model)) {
            const nestedValues = collectDataModel(otherPathComponent.v, ...origin);
            if (mapOrListDataModelIsList(model)) {
              return nestedValues.flatMap(({data}) => {
                if (!dataModelIsInteger(data)) {
                  return [];
                }
                const index = numberDataModelToNumber(data);

                const childDate = getListDataAt(model, index);
                if (childDate === undefined) {
                  return [];
                }
                return collectDataModelImpl(
                  childDate,
                  shiftDataPath(path),
                  currentContext.pushListIndex(index),
                  origin,
                );
              });
            } else {
              return nestedValues.flatMap(({data}) => {
                if (!dataModelIsString(data)) {
                  return [];
                }
                const key = stringDataModelToString(data);
                const index = getMapDataIndexAt(model, key);
                if (index === undefined) {
                  return [];
                }
                return collectDataModelImpl(
                  getMapDataAtIndex(model, index),
                  shiftDataPath(path),
                  currentContext.pushMapIndex(index, key),
                  origin,
                );
              });
            }
          } else {
            return [];
          }
        case DataPathComponentType.Union:
          return otherPathComponent.v.flatMap((pathComponent) => {
            return collectDataModelImpl(
              model,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              origin,
            );
          });
      }
    },
  });
  return result ?? [];
}

export function collectDataModel(
  path: MultiDataPath,
  model: DataModel | undefined,
  context: DataModelContext,
  root: DataModelRoot,
): DataModelCollectionItem[] {
  const [start] = dataModelForPathStart(root, model, path, context);
  return collectDataModelImpl(start, path, context, [model, context, root]);
}
