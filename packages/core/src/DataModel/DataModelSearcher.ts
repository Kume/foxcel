import {DataModel} from './DataModelTypes';
import {
  DataPath,
  DataPathComponentType,
  dataPathLength,
  headDataPathComponent,
  MultiDataPath,
  MultiDataPathComponent,
  shiftDataPath,
  unshiftDataPath,
} from './DataPath';
import {DataModelContext, dataModelForPathStart, DataModelRoot} from './DataModelContext';
import {digForPathComponent, getDataModelBySinglePath, withNestedDataPath} from './DataModelCollector';
import {
  dataModelEquals,
  dataModelIsList,
  dataModelIsMap,
  eachListDataItem,
  eachMapDataItem,
  stringToDataModel,
} from './DataModel';

interface DataModelEqualMatcher {
  readonly type: 'equal';
  readonly operand1?: DataPath;
  readonly operand2: DataModel;
}

export type DataModelMatcher = DataModelEqualMatcher;

export function dataModelIsMatch(
  matcher: DataModelMatcher,
  data: DataModel | undefined,
  context: DataModelContext,
  root: DataModelRoot,
): boolean {
  switch (matcher.type) {
    case 'equal': {
      const operand1 = matcher.operand1 ? getDataModelBySinglePath(data, matcher.operand1, context, root) : data;
      if (operand1 === undefined) {
        return false;
      }
      return dataModelEquals(matcher.operand2, operand1);
    }
  }
}

function keyIsMatch(key: string, matcher: DataModelMatcher): boolean {
  switch (matcher.type) {
    case 'equal':
      if (matcher.operand1 !== undefined) {
        throw new Error('invalid path');
      }
      return dataModelEquals(stringToDataModel(key), matcher.operand2);
  }
}

export interface DataModelSearchSingleResult {
  readonly data: DataModel;
  readonly context: DataModelContext;
}

export interface DataModelSearchParams {
  readonly path: MultiDataPath;
  readonly matcher: DataModelMatcher;
}

function findDataModelImpl(
  data: DataModel | undefined,
  matcher: DataModelMatcher,
  path: MultiDataPath,
  currentContext: DataModelContext,
  originalContext: DataModelContext,
  root: DataModelRoot,
  originalModel: DataModel | undefined,
): DataModelSearchSingleResult | undefined {
  if (!data) {
    // TODO ログ記録?
    return undefined;
  }
  if (dataPathLength(path) === 0) {
    if (dataModelIsMatch(matcher, data, currentContext, root)) {
      return {data, context: currentContext};
    } else {
      return undefined;
    }
  }
  const head = headDataPathComponent(path);
  return digForPathComponent<DataModelSearchSingleResult | undefined, MultiDataPathComponent>(data, head, {
    key: () => {
      // TODO ログ記録?
      const key = currentContext.parentKeyDataModel;
      return key !== undefined && keyIsMatch(key, matcher)
        ? {data: stringToDataModel(key), context: currentContext.pushIsParentKey()}
        : undefined;
    },
    collection: (childData, pushContext) =>
      findDataModelImpl(
        childData,
        matcher,
        shiftDataPath(path),
        pushContext(currentContext),
        originalContext,
        root,
        originalModel,
      ),
    other: (otherPathComponent): DataModelSearchSingleResult | undefined => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.WildCard:
          if (dataModelIsMap(data)) {
            // TODO ログ記録
            for (const [childData, , key, index] of eachMapDataItem(data)) {
              if (key !== null) {
                const findResult = findDataModelImpl(
                  childData,
                  matcher,
                  shiftDataPath(path),
                  currentContext.pushMapIndex(index, key),
                  originalContext,
                  root,
                  originalModel,
                );
                if (findResult) {
                  return findResult;
                }
              }
            }
          } else if (dataModelIsList(data)) {
            // TODO ログ記録
            for (const [childData, , index] of eachListDataItem(data)) {
              const findResult = findDataModelImpl(
                childData,
                matcher,
                shiftDataPath(path),
                currentContext.pushListIndex(index),
                originalContext,
                root,
                originalModel,
              );
              if (findResult) {
                return findResult;
              }
            }
          } else {
            // TODO ログ記録?
          }
          return undefined;
        case DataPathComponentType.Nested: {
          // TODO withNestedDataPathでログ記録
          const childPath = shiftDataPath(path);
          for (const [childData, childContext] of withNestedDataPath(
            data,
            otherPathComponent.v,
            originalContext,
            root,
          )) {
            const findResult = findDataModelImpl(
              childData,
              matcher,
              childPath,
              childContext,
              originalContext,
              root,
              originalModel,
            );
            if (findResult) {
              return findResult;
            }
          }
          return undefined;
        }
        case DataPathComponentType.Union:
          for (const pathComponent of otherPathComponent.v) {
            const findResult = findDataModelImpl(
              data,
              matcher,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              originalContext,
              root,
              originalModel,
            );
            if (findResult) {
              return findResult;
            }
          }
          return undefined;
      }
    },
  });
}

export function findDataModel(
  data: DataModel | undefined,
  params: DataModelSearchParams,
  context: DataModelContext,
  root: DataModelRoot,
): DataModelSearchSingleResult | undefined {
  const [startModel, startContext] = dataModelForPathStart(root, data, params.path, context);
  return findDataModelImpl(startModel, params.matcher, params.path, startContext, context, root, data);
}
