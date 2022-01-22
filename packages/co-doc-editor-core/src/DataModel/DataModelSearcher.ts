import {DataModel} from './DataModelTypes';
import {DataPath} from './DataPath';
import {DataModelContext} from './DataModelContext';
import {WritableDataModelReferenceLogNode} from './DataModelReferenceLog';
import {getDataModelBySinglePath} from './DataModelCollector';
import {dataModelEquals} from './DataModel';

interface DataModelEqualMatcher {
  readonly type: 'equal';
  readonly operand1: DataPath;
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
      const operand2 = getDataModelBySinglePath(data, matcher.operand1, context);
      if (operand2 === undefined) {
        return false;
      }
      return dataModelEquals(matcher.operand2, operand2);
    }
  }
}

export interface DataModelSearchSingleResult {
  readonly data: DataModel;
  readonly context: DataModelContext;
}

export interface DataModelSearchParams {
  readonly path: DataPath;
  readonly matcher: DataModelMatcher;
}

export function searchSingleDataModel(
  data: DataModel,
  matcher: DataModelMatcher,
  context: DataModelContext,
  writableReferenceLog: WritableDataModelReferenceLogNode,
): DataModelSearchSingleResult | undefined {}
