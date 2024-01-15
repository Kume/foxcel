import {DataModel} from './DataModelTypes';
import {
  DataPath,
  DataPathComponentType,
  dataPathLength,
  dataPathReverseCount,
  headDataPathComponent,
  MultiDataPath,
  MultiDataPathComponent,
  shiftDataPath,
  unshiftDataPath,
} from './DataPath';
import {DataModelContextWithoutSchema} from './DataModelContext';
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
  context: DataModelContextWithoutSchema,
): boolean {
  switch (matcher.type) {
    case 'equal': {
      const operand1 = matcher.operand1 ? getDataModelBySinglePath(matcher.operand1, context) : data;
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
  readonly context: DataModelContextWithoutSchema;
}

export interface DataModelSearchParams {
  readonly path: MultiDataPath;
  readonly matcher: DataModelMatcher;
}

function findDataModelImpl(
  matcher: DataModelMatcher,
  path: MultiDataPath,
  currentContext: DataModelContextWithoutSchema,
  originalContext: DataModelContextWithoutSchema,
): DataModelSearchSingleResult | undefined {
  const data = currentContext.currentModel;
  if (!data) {
    // TODO ログ記録?
    return undefined;
  }
  if (dataPathLength(path) === 0) {
    if (dataModelIsMatch(matcher, data, currentContext)) {
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
      findDataModelImpl(matcher, shiftDataPath(path), pushContext(currentContext), originalContext),
    other: (otherPathComponent): DataModelSearchSingleResult | undefined => {
      switch (otherPathComponent.t) {
        case DataPathComponentType.WildCard:
          if (dataModelIsMap(data)) {
            // TODO ログ記録
            for (const [, , key, index] of eachMapDataItem(data)) {
              if (key !== null) {
                const findResult = findDataModelImpl(
                  matcher,
                  shiftDataPath(path),
                  currentContext.pushMapIndex(index, key),
                  originalContext,
                );
                if (findResult) {
                  return findResult;
                }
              }
            }
          } else if (dataModelIsList(data)) {
            // TODO ログ記録
            for (const [, , index] of eachListDataItem(data)) {
              const findResult = findDataModelImpl(
                matcher,
                shiftDataPath(path),
                currentContext.pushListIndex(index),
                originalContext,
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
          for (const [, childContext] of withNestedDataPath(data, otherPathComponent.v, originalContext)) {
            const findResult = findDataModelImpl(matcher, childPath, childContext, originalContext);
            if (findResult) {
              return findResult;
            }
          }
          return undefined;
        }
        case DataPathComponentType.Union:
          for (const pathComponent of otherPathComponent.v) {
            const findResult = findDataModelImpl(
              matcher,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              originalContext,
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
  params: DataModelSearchParams,
  context: DataModelContextWithoutSchema,
): DataModelSearchSingleResult | undefined {
  const startContext = context.pop(dataPathReverseCount(params.path));
  return findDataModelImpl(params.matcher, params.path, startContext, context);
}
