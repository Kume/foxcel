import {DataModel} from './DataModelTypes';
import {
  DataPath,
  DataPathComponentType,
  dataPathConsecutiveReverseCount,
  dataPathLength,
  headDataPathComponent,
  MultiDataPath,
  MultiDataPathComponent,
  shiftDataPath,
  unshiftDataPath,
} from './DataPath';
import {
  DataModelContext,
  DataModelContextPathComponent,
  getCurrentKeyOrUndefinedFromDataModelContext,
  getParentDataModelFromContext,
  popDataModelContextPath,
  pushDataModelContextPath,
  pushKeyToDataModelContextPath,
} from './DataModelContext';
import {WritableDataModelReferenceLogNode} from './DataModelReferenceLog';
import {digForPathComponent, getDataModelBySinglePath, withNestedDataPath} from './DataModelCollector';
import {
  dataModelEquals,
  dataModelIsList,
  dataModelIsMap,
  eachListDataItem,
  eachMapDataItem,
  findIndexMapDataModel,
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
): boolean {
  switch (matcher.type) {
    case 'equal': {
      const operand1 = matcher.operand1 ? getDataModelBySinglePath(data, matcher.operand1, context) : data;
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
  originalModel: DataModel | undefined,
  writableReferenceLog: WritableDataModelReferenceLogNode,
): DataModelSearchSingleResult | undefined {
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
      const key = getCurrentKeyOrUndefinedFromDataModelContext(currentContext);
      return key !== undefined && keyIsMatch(key, matcher)
        ? {data: stringToDataModel(key), context: pushKeyToDataModelContextPath(currentContext)}
        : undefined;
    },
    collection: (childData, contextPathComponent) =>
      findDataModelImpl(
        childData,
        matcher,
        shiftDataPath(path),
        pushDataModelContextPath(currentContext, contextPathComponent),
        originalContext,
        originalModel,
        writableReferenceLog,
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
                  pushDataModelContextPath(currentContext, {type: 'map', data, at: key, indexCache: index}),
                  originalContext,
                  originalModel,
                  writableReferenceLog,
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
                pushDataModelContextPath(currentContext, {type: 'list', data, at: index}),
                originalContext,
                originalModel,
                writableReferenceLog,
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
          for (const [childData, childContext] of withNestedDataPath(data, otherPathComponent.v, currentContext)) {
            const findResult = findDataModelImpl(
              childData,
              matcher,
              childPath,
              childContext,
              originalContext,
              originalModel,
              writableReferenceLog,
            );
            if (findResult) {
              return findResult;
            }
          }
          return undefined;
        }
        case DataPathComponentType.Reverse: {
          const reverseCount = dataPathConsecutiveReverseCount(path);
          // TODO ログ記録を開始するフラグ管理
          return findDataModelImpl(
            getParentDataModelFromContext(currentContext, reverseCount),
            matcher,
            shiftDataPath(path, reverseCount),
            popDataModelContextPath(currentContext, reverseCount),
            originalContext,
            originalModel,
            writableReferenceLog,
          );
        }
        case DataPathComponentType.ContextKey:
          // TODO
          return undefined;
        case DataPathComponentType.Union:
          for (const pathComponent of otherPathComponent.v) {
            const findResult = findDataModelImpl(
              data,
              matcher,
              unshiftDataPath(shiftDataPath(path), pathComponent),
              currentContext,
              originalContext,
              originalModel,
              writableReferenceLog,
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
  data: DataModel,
  params: DataModelSearchParams,
  context: DataModelContext,
  writableReferenceLog: WritableDataModelReferenceLogNode,
): DataModelSearchSingleResult | undefined {
  if (params.path.isAbsolute) {
    return findDataModelImpl(
      context.root.model,
      params.matcher,
      params.path,
      context,
      context,
      data,
      writableReferenceLog,
    );
  } else {
    return findDataModelImpl(data, params.matcher, params.path, context, context, data, writableReferenceLog);
  }
}
