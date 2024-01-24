import {AppDataModelAction} from '../App/AppState';
import {TextUIModel} from './UIModelTypes';
import {nullDataModel, stringToDataModel, unknownToDataModel} from '../DataModel/DataModel';
import {TextUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {uiSchemaKeyIsParentKey} from './UISchema';

export function formatTextUIInput(schema: TextUISchema, input: string): string;
export function formatTextUIInput(schema: TextUISchema, input: string | null): string | null;
export function formatTextUIInput(schema: TextUISchema, input: string | null): string | null {
  if (input === null) {
    return null;
  }
  if (uiSchemaKeyIsParentKey(schema.key)) {
    return input.replace(/\r?\n/g, '');
  } else {
    return schema.multiline ? input.replace(/\r\n/g, '\n').trimEnd() : input.replace(/\r?\n/g, '');
  }
}

export function textUIModelSetText(model: TextUIModel, value: string | null): AppDataModelAction {
  return {
    type: 'data',
    action: model.isKey
      ? {type: 'setKey', dataContext: model.dataContext, key: formatTextUIInput(model.schema, value) || null}
      : {type: 'set', dataContext: model.dataContext, data: unknownToDataModel(formatTextUIInput(model.schema, value))},
  };
}

type Result = {type: 'key'; key: string | null} | {type: 'value'; value: DataModel};

export function textUIModelHandleInputForSchema(schema: TextUISchema, input: string | null): Result {
  // KeyTextUIModelはschemaがundefinedなのに何故こちらはschemaが存在しているのか。
  if (uiSchemaKeyIsParentKey(schema.key)) {
    return {type: 'key', key: formatTextUIInput(schema, input)};
  } else {
    return {type: 'value', value: input === null ? nullDataModel : stringToDataModel(formatTextUIInput(schema, input))};
  }
}
