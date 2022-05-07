import {DataModel, DataPointer, ListDataModel, MapDataModel} from './DataModelTypes';
import {DataSchema, DataSchemaContextKeyItem, FixedMapDataSchema, ListDataSchema, MapDataSchema} from './DataSchema';
import {
  dataModelIsList,
  dataModelIsMap,
  findMapDataIndexOfKey,
  getListDataIndexForPointer,
  getMapDataIndexForPointer,
  getMapKeyAtIndex,
} from './DataModel';
import {stringUISchemaKeyToString, UISchemaKey, uiSchemaKeyIsParentKey} from '../UIModel/UISchema';

export interface DataModelContextListPathComponent {
  readonly type: 'list';
  readonly data: ListDataModel;
  readonly at?: number;
}

export interface DataModelContextMapPathComponent {
  readonly type: 'map';
  readonly data: MapDataModel;
  readonly at: string;
  readonly indexCache: number;
}

export interface DataModelContextMapEmptyPathComponent {
  readonly type: 'map';
  readonly data: MapDataModel;
  readonly at?: undefined;
  readonly indexCache?: undefined;
}

export interface DataModelContextUndefinedPathComponent {
  readonly type: 'undefined';
  readonly data?: undefined;
}

export type DataModelContextPathComponent =
  | DataModelContextListPathComponent
  | DataModelContextMapPathComponent
  | DataModelContextMapEmptyPathComponent
  | DataModelContextUndefinedPathComponent;

export interface DataModelRoot {
  readonly model: DataModel;
  readonly schema: DataSchema;
}

export interface DataModelContext {
  // readonly root: DataModelRoot;
  readonly contextKeys?: readonly DataSchemaContextKeyItem[];
  readonly path: readonly DataModelContextPathComponent[];
  readonly isKey?: boolean;
}

export const emptyDataModelContext: DataModelContext = {path: []};

export const undefinedDataModelContextPathComponent: DataModelContextUndefinedPathComponent = {type: 'undefined'};

export function dataModelContextDepth(context: DataModelContext): number {
  return context.path.length;
}

export function dataModelContextPathComponentAt(
  context: DataModelContext,
  index: number,
): DataModelContextPathComponent {
  return context.path[index];
}

export function dataModelContextPathLastComponent(
  context: DataModelContext,
): DataModelContextPathComponent | undefined {
  return context.path[context.path.length - 1];
}

export function dataModelContextNodeIsMap(
  node: DataModelContextPathComponent,
): node is DataModelContextMapPathComponent {
  return node.type === 'map';
}

export function dataModelContextNodeIsList(
  node: DataModelContextPathComponent,
): node is DataModelContextListPathComponent {
  return node.type === 'list';
}

export function pushDataModelContextPath(
  context: DataModelContext,
  component: DataModelContextPathComponent,
): DataModelContext {
  if (context.isKey) {
    throw new Error('Cannot push to key context');
  }
  return {
    ...context,
    path: [...context.path, component],
  };
}

export function pushMapDataModelContextPath(
  context: DataModelContext,
  dataModel: DataModel | undefined,
  key: string | null | undefined,
): DataModelContext {
  if (!dataModelIsMap(dataModel)) {
    return pushDataModelContextPath(context, undefinedDataModelContextPathComponent);
  }
  return pushDataModelContextPath(context, mapDataModelContextPathForDataModel(dataModel, key));
}

export function mapDataModelContextPathForDataModel(
  map: MapDataModel,
  key: string | null | undefined,
): DataModelContextPathComponent {
  if (key === undefined || key === null) {
    return {type: 'map', data: map};
  }
  const index = findMapDataIndexOfKey(map, key);
  if (index === undefined) {
    return {type: 'map', data: map};
  }
  return {type: 'map', data: map, at: key, indexCache: index};
}

export function pushUiSchemaKeyToDataModelContext(
  context: DataModelContext,
  dataModel: DataModel | undefined,
  key: UISchemaKey | undefined,
): DataModelContext {
  if (!dataModelIsMap(dataModel)) {
    return pushDataModelContextPath(context, undefinedDataModelContextPathComponent);
  }
  return pushDataModelContextPath(context, uiSchemaKeyToDataModelContextPathComponent(dataModel, key));
}

export function uiSchemaKeyToDataModelContextPathComponent(
  map: MapDataModel,
  key: UISchemaKey | undefined,
): DataModelContextPathComponent {
  if (uiSchemaKeyIsParentKey(key)) {
    return undefinedDataModelContextPathComponent;
  } else {
    return mapDataModelContextPathForDataModel(map, stringUISchemaKeyToString(key));
  }
}

export function pushListDataModelContextPath(
  context: DataModelContext,
  dataModel: DataModel | undefined,
  index: number | undefined,
): DataModelContext {
  if (!dataModelIsList(dataModel)) {
    return pushDataModelContextPath(context, undefinedDataModelContextPathComponent);
  }
  return pushDataModelContextPath(context, listDataModelContextPathForDataModel(dataModel, index));
}

export function listDataModelContextPathForDataModel(
  list: ListDataModel,
  index: number | undefined,
): DataModelContextListPathComponent {
  if (index === undefined) {
    return {type: 'list', data: list};
  }
  return {type: 'list', data: list, at: index};
}

export function pushPointerToDataModelContext(
  context: DataModelContext,
  model: DataModel | undefined,
  pointer: DataPointer,
): DataModelContext {
  if (dataModelIsMap(model)) {
    return pushDataModelContextPath(context, dataModelContextPathForMapModelPointer(model, pointer));
  } else if (dataModelIsList(model)) {
    return pushDataModelContextPath(context, dataModelContextPathForListModelPointer(model, pointer));
  } else {
    return pushDataModelContextPath(context, undefinedDataModelContextPathComponent);
  }
}

function dataModelContextPathForMapModelPointer(
  map: MapDataModel,
  pointer: DataPointer,
): DataModelContextPathComponent {
  const index = getMapDataIndexForPointer(map, pointer);
  if (index === undefined) {
    return {type: 'map', data: map};
  }
  const key = getMapKeyAtIndex(map, index);
  if (key === undefined || key === null) {
    return {type: 'map', data: map};
  }
  return {type: 'map', data: map, at: key, indexCache: index};
}

function dataModelContextPathForListModelPointer(
  list: ListDataModel,
  pointer: DataPointer,
): DataModelContextPathComponent {
  return {type: 'list', data: list, at: getListDataIndexForPointer(list, pointer)};
}

export function pushKeyToDataModelContextPath(context: DataModelContext): DataModelContext {
  return {...context, isKey: true};
}

export function popDataModelContextPath(context: DataModelContext, count = 1): DataModelContext {
  if (context.isKey) {
    return {contextKeys: context.contextKeys, path: context.path};
  } else {
    return {
      ...context,
      path: context.path.slice(0, -count),
    };
  }
}

export function getCurrentKeyOrUndefinedFromDataModelContext(context: DataModelContext): string | undefined {
  // TODO isKeyの考慮
  const lastComponent = dataModelContextPathLastComponent(context);
  if (!lastComponent) {
    return undefined;
  }
  if (lastComponent.type === 'map') {
    return lastComponent.at;
  } else if (lastComponent.type === 'list') {
    return lastComponent.at.toString();
  } else {
    return undefined;
  }
}

export function getParentDataModelFromContext(context: DataModelContext, count = 1): DataModel | undefined {
  const component = dataModelContextPathComponentAt(context, dataModelContextDepth(context) - count);
  return component === undefined ? undefined : component.data;
}
