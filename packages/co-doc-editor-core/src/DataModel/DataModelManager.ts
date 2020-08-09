import {DataCollectionItem, DataModel} from './DataModelTypes';
import {
  DataPathComponentType,
  dataPathLastComponent,
  dataPathLength,
  ForwardDataPath,
  headDataPathComponent,
  headDataPathComponentOrUndefined,
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
  getMapDataAt,
  getMapKeyValueAtIndex,
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

export class DataModelManager {
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

      case 'symbol':
        return index === undefined ? [] : [{data: index, path: currentPath, index}];

      case 'number': {
        if (dataModelIsList(model)) {
          const gotData = getListDataAt(model, head);
          return gotData === undefined
            ? []
            : this._collect(gotData, shiftDataPath(path), pushDataPath(currentPath, head), head, origin);
        } else if (dataModelIsMap(model)) {
          const kayValue = getMapKeyValueAtIndex(model, head);
          return kayValue === undefined
            ? []
            : this._collect(
                kayValue[1],
                shiftDataPath(path),
                pushDataPath(currentPath, head),
                kayValue[0] ?? undefined,
                origin,
              );
        } else {
          return [];
        }
      }
    }

    switch (head.t) {
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

      case DataPathComponentType.Nested: {
        if (dataModelIsList(model)) {
          const resolvedResults = this._collect(origin.model, head.v, origin.path, undefined, origin);
          return resolvedResults.flatMap(({index, data}) => {
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
          return resolvedResults.flatMap(({index, data}) => {
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
