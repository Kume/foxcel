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
  dataPathLength,
  ForwardDataPath,
  headDataPathComponent,
  headDataPathComponentOrUndefined,
  listIndexToDataPathComponent,
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
  getFromDataModel,
  getListDataAt,
  getListDataIndexForPointer,
  getMapDataAt,
  getMapDataAtIndex,
  getMapDataIndexForPointer,
  getMapKeyAtIndex,
  numberDataModelToNumber,
  stringToDataModel,
} from './DataModel';
import {
  DataSchema,
  dataSchemaContextKeyDepth,
  DataSchemaContextKeyItem,
  dataSchemaContextKeysForPath,
  NamedDataSchemaManager,
} from './DataSchema';

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

interface DigCallbacks<Return> {
  key: () => Return;
  map: (model: MapDataModel, key: string) => Return;
  list: (model: ListDataModel, key: number) => Return;
  other: () => Return;
}

function digForPathComponent<Return>(
  model: DataModel,
  pathComponent: DataPathComponent,
  callbacks: DigCallbacks<Return>,
): Return | undefined {
  if (dataPathComponentIsKey(pathComponent)) {
    return callbacks.key();
  } else if (dataPathComponentIsMapKey(pathComponent)) {
    return dataModelIsMap(model) ? callbacks.map(model, dataPathComponentToMapKey(pathComponent)) : undefined;
  } else if (dataPathComponentIsListIndex(pathComponent)) {
    return dataModelIsList(model) ? callbacks.list(model, dataPathComponentToListIndex(pathComponent)) : undefined;
  } else if (dataPathComponentIsIndexOrKey(pathComponent)) {
    if (dataModelIsList(model)) {
      return callbacks.list(model, dataPathComponentToListIndex(pathComponent));
    } else if (dataModelIsMap(model)) {
      return callbacks.map(model, dataPathComponentToMapKey(pathComponent));
    } else {
      return undefined;
    }
  } else if (dataPathComponentIsPointer(pathComponent)) {
    if (dataModelIsList(model)) {
      const listIndex = getListDataIndexForPointer(model, pathComponent);
      return listIndex === undefined ? undefined : callbacks.list(model, listIndex);
    } else if (dataModelIsMap(model)) {
      const index = getMapDataIndexForPointer(model, pathComponent);
      const mapKey = index === undefined ? undefined : getMapKeyAtIndex(model, index);
      return mapKey === undefined || mapKey === null ? undefined : callbacks.map(model, mapKey);
    } else {
      return undefined;
    }
  } else {
    return callbacks.other();
  }
}

function getDataModelBySinglePathImpl(
  model: DataModel | undefined,
  path: DataPath,
  currentDataPath: ForwardDataPath,
  key: string | undefined,
  context: CollectDataModelContext,
): DataModel | undefined {
  if (model === undefined) {
    return model;
  }

  if (dataPathLength(path) === 0) {
    return model;
  }

  const head = headDataPathComponent(path);
  if (dataPathComponentIsKey(head)) {
    return key === undefined ? undefined : stringToDataModel(key);
  } else if (dataPathComponentIsMapKey(head)) {
    if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(head);
      return getDataModelBySinglePathImpl(
        getMapDataAt(model, mapKey),
        shiftDataPath(path),
        pushDataPath(currentDataPath, head),
        mapKey,
        context,
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
        pushDataPath(currentDataPath, head),
        listIndex.toString(),
        context,
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
        pushDataPath(currentDataPath, head),
        listIndex.toString(),
        context,
      );
    } else if (dataModelIsMap(model)) {
      const mapKey = dataPathComponentToMapKey(head);
      return getDataModelBySinglePathImpl(
        getMapDataAt(model, mapKey),
        shiftDataPath(path),
        pushDataPath(currentDataPath, head),
        mapKey,
        context,
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
            pushDataPath(currentDataPath, head),
            listIndex.toString(),
            context,
          );
    } else if (dataModelIsMap(model)) {
      const index = getMapDataIndexForPointer(model, head);
      const mapKey = index === undefined ? undefined : getMapKeyAtIndex(model, index);
      return mapKey === undefined || mapKey === null
        ? undefined
        : getDataModelBySinglePathImpl(
            getMapDataAt(model, mapKey),
            shiftDataPath(path),
            pushDataPath(currentDataPath, head),
            mapKey,
            context,
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
  currentDataPath: ForwardDataPath,
  key: string | undefined,
  global: CollectDataModelGlobal,
): DataModel | undefined {
  return getDataModelBySinglePathImpl(model, path, currentDataPath, key, {
    ...global,
    currentModel: model,
    currentPath: currentDataPath,
  });
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
