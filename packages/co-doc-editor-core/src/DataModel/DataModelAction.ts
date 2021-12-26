import {dataPathLength, ForwardDataPath} from './DataPath';
import {DataModel} from './DataModelTypes';
import {pushToDataModel, setToDataModel} from './DataModel';
import {DataSchema, DataSchemaContext, DataSchemaExcludeRecursive} from './DataSchema';

export interface PushDataModelAction {
  readonly type: 'push';
  readonly path: ForwardDataPath;
  readonly data: DataModel;
}

export interface SetDataModelAction {
  readonly type: 'set';
  readonly path: ForwardDataPath;
  readonly data: DataModel;
}

export type DataModelAction = PushDataModelAction | SetDataModelAction;

export function execDataModelAction(
  model: DataModel | undefined,
  schema: DataSchemaExcludeRecursive | undefined,
  action: DataModelAction,
): DataModel | undefined {
  const schemaContext = schema && DataSchemaContext.createRootContext(schema);
  switch (action.type) {
    case 'set':
      if (dataPathLength(action.path) === 0) {
        return action.data;
      } else {
        return model === undefined ? undefined : setToDataModel(action.path, action.data, model, schemaContext);
      }

    case 'push':
      return model === undefined ? undefined : pushToDataModel(action.path, action.data, model, schemaContext);
  }
}
