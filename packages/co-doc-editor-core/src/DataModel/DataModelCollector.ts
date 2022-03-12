import {DataCollectionItem, DataModel, ListDataModel, MapDataModel} from './DataModelTypes';
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
  headDataPathComponentOrUndefined,
  KeyPathComponent,
  listIndexToDataPathComponent,
  MapKeyDataPathComponent,
  MultiDataPath,
  MultiDataPathComponent,
  popDataPath,
  pushDataPath,
  shiftDataPath,
  unshiftDataPath,
} from './DataPath';
import {
  dataModelIsInteger,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsMapOrList,
  dataModelIsString,
  dataModelMap,
  findMapDataIndexOfKey,
  getFromDataModel,
  getListDataAt,
  getListDataIndexForPointer,
  getMapDataAt,
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
import {
  DataSchema,
  dataSchemaContextKeyDepth,
  DataSchemaContextKeyItem,
  dataSchemaContextKeysForPath,
  NamedDataSchemaManager,
} from './DataSchema';
import {WritableDataModelReferenceLogNode} from './DataModelReferenceLog';
import {
  DataModelContext,
  DataModelContextMapPathComponent,
  DataModelContextPathComponent,
  DataModelRoot,
  getCurrentKeyOrUndefinedFromDataModelContext,
  getParentDataModelFromContext,
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
  return indexCache === undefined ? undefined : {type: 'map', data, at: mapKey, indexCache};
}

export function digForPathComponent<Return, PathComponent extends MultiDataPathComponent>(
  model: DataModel,
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
      return callbacks.collection(childData, {type: 'map', data: model, at: mapKey, indexCache});
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
    return callbacks.collection(childData, {type: 'list', data: model, at: listIndex});
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    if (dataModelIsList(model)) {
      const listIndex = dataPathComponentToListIndex(pathComponent);
      const childData = getListDataAt(model, listIndex);
      if (childData === undefined) {
        return undefined;
      }
      return callbacks.collection(childData, {type: 'list', data: model, at: listIndex});
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
      return callbacks.collection(childData, {type: 'map', data: model, at: mapKey, indexCache});
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
      return callbacks.collection(childData, {type: 'list', data: model, at: listIndex});
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
      return callbacks.collection(childData, {type: 'map', data: model, at: mapKey, indexCache});
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
): DataModel | undefined {
  if (model === undefined) {
    return model;
  }

  if (dataPathLength(path) === 0) {
    return model;
  }

  const head = headDataPathComponent(path);
  if (dataPathComponentIsKey(head)) {
    const key = getCurrentKeyOrUndefinedFromDataModelContext(currentContext);
    return key === undefined ? undefined : stringToDataModel(key);
  } else if (dataPathComponentIsMapKey(head)) {
    if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(head);
      const index = findMapDataIndexOfKey(model, mapKey);
      if (index === undefined) {
        return undefined;
      }
      return getDataModelBySinglePathImpl(
        getMapDataAtIndex(model, index),
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, {type: 'map', data: model, at: mapKey, indexCache: index}),
        originalContext,
      );
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsListIndex(head)) {
    if (dataModelIsList(model)) {
      const listIndex = dataPathComponentToListIndex(head);
      return getDataModelBySinglePathImpl(
        getListDataAt(model, listIndex),
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, {type: 'list', data: model, at: listIndex}),
        originalContext,
      );
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsIndexOrKey(head)) {
    if (dataModelIsList(model)) {
      const listIndex = dataPathComponentToListIndex(head);
      return getDataModelBySinglePathImpl(
        getListDataAt(model, listIndex),
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, {type: 'list', data: model, at: listIndex}),
        originalContext,
      );
    } else if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(head);
      const index = findMapDataIndexOfKey(model, mapKey);
      if (index === undefined) {
        return undefined;
      }
      return getDataModelBySinglePathImpl(
        getMapDataAtIndex(model, index),
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, {type: 'map', data: model, at: mapKey, indexCache: index}),
        originalContext,
      );
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsPointer(head)) {
    if (dataModelIsList(model)) {
      const listIndex = getListDataIndexForPointer(model, head);
      return listIndex === undefined
        ? undefined
        : getDataModelBySinglePathImpl(
            getListDataAt(model, listIndex),
            shiftDataPath(path),
            pushDataModelContextPath(currentContext, {type: 'list', data: model, at: listIndex}),
            originalContext,
          );
    } else if (dataModelIsMap(model)) {
      const index = getMapDataIndexForPointer(model, head);
      if (index === undefined) {
        return undefined;
      }
      const mapKey = getMapKeyAtIndex(model, index);
      if (mapKey === undefined || mapKey === null) {
        return undefined;
      }
      return getDataModelBySinglePathImpl(
        getMapDataAt(model, mapKey),
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, {type: 'map', data: model, at: mapKey, indexCache: index}),
        originalContext,
      );
    } else {
      return undefined;
    }
  }
  // switch (head.t) {
  //   case DataPathComponentType.Reverse:
  //     return getDataModelBySinglePathImpl();
  //   case DataPathComponentType.ContextKey:
  //     break;
  //   case DataPathComponentType.Nested:
  //     break;
  // }
}

export function getDataModelBySinglePath(
  model: DataModel | undefined,
  path: DataPath,
  context: DataModelContext,
  dataRoot: DataModelRoot,
): DataModel | undefined {
  if (path.isAbsolute) {
    return getDataModelBySinglePathImpl(dataRoot.model, path, context, context);
  } else {
    return getDataModelBySinglePathImpl(model, path, context, context);
  }
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
    const nestedValues = collectDataModel2(model, path, context, root);
    if (mapOrListDataModelIsList(model)) {
      for (const {data} of nestedValues) {
        if (!dataModelIsInteger(data)) {
          continue;
        }
        const index = numberDataModelToNumber(data);
        yield [getListDataAt(model, index), pushDataModelContextPath(context, {type: 'list', data: model, at: index})];
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
          pushDataModelContextPath(context, {type: 'map', data: model, at: key, indexCache: index}),
        ];
      }
    }
  }
}

function collectDataModelImpl2(
  model: DataModel | undefined,
  path: MultiDataPath,
  currentContext: DataModelContext,
  originalContext: DataModelContext,
  originalModel: DataModel | undefined,
): DataModelCollectionItem[] {
  if (!model) {
    return [];
  }
  if (dataPathLength(path) === 0) {
    return [{data: model, context: currentContext}];
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
      collectDataModelImpl2(
        childData,
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, contextPathComponent),
        originalContext,
        originalModel,
      ),
    other: (otherPathComponent): DataModelCollectionItem[] => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.WildCard:
          if (dataModelIsMap(model)) {
            return mapMapDataModel(model, (value, key, index) => {
              return key === null
                ? []
                : collectDataModelImpl2(
                    getMapDataAtIndex(model, index),
                    shiftDataPath(path),
                    pushDataModelContextPath(currentContext, {type: 'map', data: model, at: key, indexCache: index}),
                    originalContext,
                    originalModel,
                  );
            }).flat();
          } else if (dataModelIsList(model)) {
            return mapListDataModel(model, (value, index) => {
              return collectDataModelImpl2(
                getListDataAt(model, index),
                shiftDataPath(path),
                pushDataModelContextPath(currentContext, {type: 'list', data: model, at: index}),
                originalContext,
                originalModel,
              );
            }).flat();
          } else {
            return [];
          }
        case DataPathComponentType.Nested:
          if (dataModelIsMapOrList(model)) {
            const nestedValues = collectDataModelImpl2(
              originalModel,
              otherPathComponent.v,
              originalContext,
              originalContext,
              originalModel,
            );
            if (mapOrListDataModelIsList(model)) {
              return nestedValues.flatMap(({data}) => {
                if (!dataModelIsInteger(data)) {
                  return [];
                }
                const index = numberDataModelToNumber(data);
                return collectDataModelImpl2(
                  getListDataAt(model, index),
                  shiftDataPath(path),
                  pushDataModelContextPath(currentContext, {type: 'list', data: model, at: index}),
                  originalContext,
                  originalModel,
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
                return collectDataModelImpl2(
                  getMapDataAtIndex(model, index),
                  shiftDataPath(path),
                  pushDataModelContextPath(currentContext, {type: 'map', data: model, at: key, indexCache: index}),
                  originalContext,
                  originalModel,
                );
              });
            }
          } else {
            return [];
          }
        case DataPathComponentType.Reverse: {
          const reverseCount = dataPathConsecutiveReverseCount(path);
          return collectDataModelImpl2(
            getParentDataModelFromContext(currentContext, reverseCount),
            shiftDataPath(path, reverseCount),
            popDataModelContextPath(currentContext, reverseCount),
            originalContext,
            originalModel,
          );
        }
        case DataPathComponentType.ContextKey:
          // TODO DataModelContextにスキーマをもたせてから
          return [];
        case DataPathComponentType.Union:
          return otherPathComponent.v.flatMap((pathComponent) => {
            return collectDataModelImpl2(
              model,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              originalContext,
              originalModel,
            );
          });
      }
    },
  });
  return result ?? [];
}

export function collectDataModel2(
  model: DataModel | undefined,
  path: MultiDataPath,
  context: DataModelContext,
  root: DataModelRoot,
): DataModelCollectionItem[] {
  if (path.isAbsolute) {
    return collectDataModelImpl2(root.model, path, context, context, model);
  } else {
    return collectDataModelImpl2(model, path, context, context, model);
  }
}

function collectDataModelImpl(
  model: DataModel | undefined,
  path: MultiDataPath,
  currentDataPath: ForwardDataPath,
  key: string | undefined,
  context: CollectDataModelContext,
): DataCollectionItem[] {
  if (!model) {
    return [];
  }
  if (dataPathLength(path) === 0) {
    return [{data: model, path: currentDataPath, key}];
  }
  const head = headDataPathComponent(path);
  switch (typeof head) {
    case 'string': {
      if (!dataModelIsMap(model)) {
        return [];
      }
      const gotData = getMapDataAt(model, head);
      return gotData === undefined
        ? []
        : collectDataModelImpl(gotData, shiftDataPath(path), pushDataPath(currentDataPath, head), head, context);
    }

    case 'number': {
      if (dataModelIsList(model)) {
        const gotData = getListDataAt(model, head);
        return gotData === undefined
          ? []
          : collectDataModelImpl(
              gotData,
              shiftDataPath(path),
              pushDataPath(currentDataPath, head),
              head.toString(),
              context,
            );
      } else if (dataModelIsMap(model)) {
        const key = getMapKeyAtIndex(model, head);
        const value = getMapDataAtIndex(model, head);
        if (key === undefined || value === undefined) {
          return [];
        }
        return collectDataModelImpl(
          value,
          shiftDataPath(path),
          pushDataPath(currentDataPath, head),
          key ?? undefined,
          context,
        );
      } else {
        return [];
      }
    }
  }

  switch (head.t) {
    case DataPathComponentType.Key: {
      return key === undefined ? [] : [{data: stringToDataModel(key), path: currentDataPath, key}];
    }

    case DataPathComponentType.Reverse: {
      let head_: undefined | MultiDataPathComponent;
      // TODO 共通化
      do {
        path = shiftDataPath(path);
        head_ = headDataPathComponentOrUndefined(path);
        currentDataPath = popDataPath(currentDataPath);
      } while (typeof head_ === 'object' && head_.t === DataPathComponentType.Reverse);
      return collectDataModelImpl(
        getFromDataModel(context.rootModel, currentDataPath),
        path,
        currentDataPath,
        undefined,
        context,
      );
    }

    case DataPathComponentType.ContextKey: {
      // if (!context.contextKeys) {
      //   context.contextKeys = dataSchemaContextKeysForPath(context.rootSchema, context.currentPath, context.schemaManager, (path) =>
      //     this.collect(origin.model, path, origin.path),
      //   );
      // }
      // const depth = dataSchemaContextKeyDepth(origin.contextKeys, head.v);
      // if (depth === undefined) {
      //   return [];
      // }
      // for (let i = 0; i < depth; i++) {
      //   currentPath = popDataPath(currentPath);
      // }
      // return collectDataModelImpl(
      //   getFromDataModel(this.rootModel, currentPath),
      //   shiftDataPath(path),
      //   currentPath,
      //   undefined,
      //   origin,
      // );
      return []; // TODO
    }

    case DataPathComponentType.IndexOrKey: {
      if (dataModelIsList(model)) {
        const gotData = getListDataAt(model, head.v);
        // TODO 隠蔽
        return gotData === undefined ? [] : [{data: gotData, path: pushDataPath(currentDataPath, head.v)}];
      } else if (dataModelIsMap(model)) {
        const key = head.v.toString(10);
        const gotData = getMapDataAt(model, key);
        return gotData === undefined ? [] : [{data: gotData, path: pushDataPath(currentDataPath, key)}];
      } else {
        return [];
      }
    }

    case DataPathComponentType.Pointer: {
      if (dataModelIsMap(model)) {
        const gotData = getListDataIndexForPointer(model, head);
        return []; // TODO
      } else if (dataModelIsList(model)) {
        const index = getListDataIndexForPointer(model, head);
        const gotData = index === undefined ? undefined : getListDataAt(model, index);
        return gotData === undefined || index === undefined
          ? []
          : [{data: gotData, path: pushDataPath(currentDataPath, listIndexToDataPathComponent(index))}];
      } else {
        return [];
      }
    }

    case DataPathComponentType.Nested: {
      if (dataModelIsList(model)) {
        const resolvedResults = collectDataModelImpl(
          context.currentModel,
          head.v,
          context.currentPath,
          undefined,
          context,
        );
        return resolvedResults.flatMap(({data}) => {
          return dataModelIsInteger(data)
            ? collectDataModelImpl(
                getListDataAt(model, data),
                shiftDataPath(path),
                pushDataPath(currentDataPath, data),
                numberDataModelToNumber(data).toString(),
                context,
              )
            : [];
        });
      } else if (dataModelIsMap(model)) {
        const resolvedResults = collectDataModelImpl(
          context.currentModel,
          head.v,
          context.currentPath,
          undefined,
          context,
        );
        return resolvedResults.flatMap(({data}) => {
          return dataModelIsString(data)
            ? collectDataModelImpl(
                getMapDataAt(model, data),
                shiftDataPath(path),
                pushDataPath(currentDataPath, data),
                data,
                context,
              )
            : [];
        });
      } else {
        return [];
      }
    }

    case DataPathComponentType.Union: {
      path = shiftDataPath(path);
      return head.v.flatMap((pathComponent) =>
        collectDataModelImpl(model, unshiftDataPath(path, pathComponent), currentDataPath, key, context),
      );
    }

    case DataPathComponentType.WildCard: {
      if (dataModelIsMapOrList(model)) {
        return dataModelMap(model, (value, key, index) =>
          collectDataModelImpl(
            value,
            shiftDataPath(path),
            pushDataPath(currentDataPath, index ?? key),
            key.toString(),
            context,
          ),
        ).flat();
      } else {
        return [];
      }
    }
  }
}

export interface ReferenceDataResult {
  readonly log: WritableDataModelReferenceLogNode | undefined;
  readonly data: string;
  readonly context: DataModelContext;
}

export function collectDataModel(
  model: DataModel | undefined,
  path: MultiDataPath,
  currentDataPath: ForwardDataPath,
  key: string | undefined,
  global: CollectDataModelGlobal,
): DataCollectionItem[] {
  return collectDataModelImpl(model, path, currentDataPath, key, {
    ...global,
    currentModel: model,
    currentPath: currentDataPath,
  });
}

export class DataModelCollector {
  constructor(
    private rootModel: DataModel,
    private rootSchema: DataSchema,
    private schemaManager: NamedDataSchemaManager,
  ) {}

  public collect(
    model: DataModel | undefined,
    path: MultiDataPath,
    currentPath: ForwardDataPath,
  ): DataCollectionItem[] {
    const origin = {model, path: currentPath};
    return this._collect(model, path, currentPath, undefined, origin);
  }

  private _collect(
    model: DataModel | undefined,
    path: MultiDataPath,
    currentPath: ForwardDataPath,
    index: number | string | undefined,
    origin: CollectOrigin,
  ): DataCollectionItem[] {
    if (!model) {
      return [];
    }
    if (dataPathLength(path) === 0) {
      return [{data: model, path: currentPath, index}];
    }
    const head = headDataPathComponent(path);
    switch (typeof head) {
      case 'string': {
        if (!dataModelIsMap(model)) {
          return [];
        }
        const gotData = getMapDataAt(model, head);
        return gotData === undefined
          ? []
          : this._collect(gotData, shiftDataPath(path), pushDataPath(currentPath, head), head, origin);
      }

      case 'number': {
        if (dataModelIsList(model)) {
          const gotData = getListDataAt(model, head);
          return gotData === undefined
            ? []
            : this._collect(gotData, shiftDataPath(path), pushDataPath(currentPath, head), head, origin);
        } else if (dataModelIsMap(model)) {
          const key = getMapKeyAtIndex(model, head);
          const value = getMapDataAtIndex(model, head);
          if (key === undefined || value === undefined) {
            return [];
          }
          return this._collect(value, shiftDataPath(path), pushDataPath(currentPath, head), key ?? undefined, origin);
        } else {
          return [];
        }
      }
    }

    switch (head.t) {
      case DataPathComponentType.Key: {
        return index === undefined ? [] : [{data: index, path: currentPath, index}];
      }

      case DataPathComponentType.Reverse: {
        let head_: undefined | MultiDataPathComponent;
        do {
          path = shiftDataPath(path);
          head_ = headDataPathComponentOrUndefined(path);
          currentPath = popDataPath(currentPath);
        } while (typeof head_ === 'object' && head_.t === DataPathComponentType.Reverse);
        return this._collect(getFromDataModel(this.rootModel, currentPath), path, currentPath, undefined, origin);
      }

      case DataPathComponentType.ContextKey: {
        if (!origin.contextKeys) {
          origin.contextKeys = dataSchemaContextKeysForPath(this.rootSchema, origin.path, this.schemaManager, (path) =>
            this.collect(origin.model, path, origin.path),
          );
        }
        const depth = dataSchemaContextKeyDepth(origin.contextKeys, head.v);
        if (depth === undefined) {
          return [];
        }
        for (let i = 0; i < depth; i++) {
          currentPath = popDataPath(currentPath);
        }
        return this._collect(
          getFromDataModel(this.rootModel, currentPath),
          shiftDataPath(path),
          currentPath,
          undefined,
          origin,
        );
      }

      case DataPathComponentType.IndexOrKey: {
        if (dataModelIsList(model)) {
          const gotData = getListDataAt(model, head.v);
          return gotData === undefined ? [] : [{data: gotData, path: pushDataPath(currentPath, head.v)}];
        } else if (dataModelIsMap(model)) {
          const key = head.v.toString(10);
          const gotData = getMapDataAt(model, key);
          return gotData === undefined ? [] : [{data: gotData, path: pushDataPath(currentPath, key)}];
        } else {
          return [];
        }
      }

      case DataPathComponentType.Pointer: {
        if (dataModelIsMap(model)) {
          const gotData = getListDataIndexForPointer(model, head);
          return []; // TODO
        } else if (dataModelIsList(model)) {
          const index = getListDataIndexForPointer(model, head);
          const gotData = index === undefined ? undefined : getListDataAt(model, index);
          return gotData === undefined ? [] : [{data: gotData, path: pushDataPath(currentPath, key)}];
        } else {
          return [];
        }
      }

      case DataPathComponentType.Nested: {
        if (dataModelIsList(model)) {
          const resolvedResults = this._collect(origin.model, head.v, origin.path, undefined, origin);
          return resolvedResults.flatMap(({data}) => {
            return dataModelIsInteger(data)
              ? this._collect(
                  getListDataAt(model, data),
                  shiftDataPath(path),
                  pushDataPath(currentPath, data),
                  data,
                  origin,
                )
              : [];
          });
        } else if (dataModelIsMap(model)) {
          const resolvedResults = this._collect(origin.model, head.v, origin.path, undefined, origin);
          return resolvedResults.flatMap(({data}) => {
            return dataModelIsString(data)
              ? this._collect(
                  getMapDataAt(model, data),
                  shiftDataPath(path),
                  pushDataPath(currentPath, data),
                  data,
                  origin,
                )
              : [];
          });
        } else {
          return [];
        }
      }

      case DataPathComponentType.Union: {
        path = shiftDataPath(path);
        return head.v.flatMap((pathComponent) =>
          this._collect(model, unshiftDataPath(path, pathComponent), currentPath, index, origin),
        );
      }

      case DataPathComponentType.WildCard: {
        if (dataModelIsMapOrList(model)) {
          return dataModelMap(model, (value, key, index) =>
            this._collect(value, shiftDataPath(path), pushDataPath(currentPath, index ?? key), key, origin),
          ).flat();
        } else {
          return [];
        }
      }
    }
  }
}
