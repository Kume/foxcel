import {AppDataModelAction} from '../App/AppState';
import {TextUIModel} from './UIModelTypes';
import {nullDataModel, stringToDataModel, unknownToDataModel} from '../DataModel/DataModel';
import {TextUISchema} from './UISchemaTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {uiSchemaKeyIsParentKey} from './UISchema';
import {isNullOrEmptyString} from '../common/utils';
import {DataModelAtomicAction} from '../DataModel/DataModelAction';

function formatTextUIInput(schema: TextUISchema, input: string): string;
function formatTextUIInput(schema: TextUISchema, input: string | null): string | null;
function formatTextUIInput(schema: TextUISchema, input: string | null): string | null {
  if (input === null) {
    return null;
  }
  if (uiSchemaKeyIsParentKey(schema.key)) {
    return input.replace(/\r?\n/g, '');
  } else {
    return schema.multiline ? input.replace(/\r\n/g, '\n').trimEnd() : input.replace(/\r?\n/g, '');
  }
}

export function textUIModelSetText(model: TextUIModel, value: string | null) {
  const dataAction = dataActionForValue(model, value);
  return dataAction && ({type: 'data', action: dataAction} as const satisfies AppDataModelAction);
}

function dataActionForValue(model: TextUIModel, value: string | null): DataModelAtomicAction | undefined {
  const handle = textUIModelHandleInputForSchema(model.schema, value);
  switch (handle.type) {
    case 'empty':
      return model.value === undefined ? undefined : {type: 'delete', dataContext: model.dataContext};
    case 'key':
      return {type: 'setKey', dataContext: model.dataContext, key: handle.key};
    case 'value':
      return {type: 'set', dataContext: model.dataContext, data: handle.value};
  }
}

type Result = {type: 'key'; key: string | null} | {type: 'value'; value: DataModel} | {type: 'empty'};

export function textUIModelHandleInputForSchema(schema: TextUISchema, input: string | null): Result {
  const formatted = formatTextUIInput(schema, input);
  return uiSchemaKeyIsParentKey(schema.key)
    ? {type: 'key', key: formatted}
    : isNullOrEmptyString(formatted)
    ? {type: 'empty'}
    : {type: 'value', value: stringToDataModel(formatted)};
}
