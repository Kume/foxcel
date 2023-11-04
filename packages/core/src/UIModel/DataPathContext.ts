import {ForwardDataPathComponent, toMapKeyDataPathComponent} from '../DataModel/DataPath';
import {UISchemaKey, uiSchemaKeyIsParentKey} from './UISchema';
import {DataModel, MapDataModel} from '../DataModel/DataModelTypes';
import {getMapDataAtPathComponent} from '../DataModel/DataModel';

export function stringUISchemaKeyToDataPathComponent(key: string | undefined): ForwardDataPathComponent {
  if (key === undefined) {
    throw new Error('content must have key.');
  }
  return toMapKeyDataPathComponent(key);
}

export function uiSchemaKeyToDataPathComponent(key: UISchemaKey | undefined): ForwardDataPathComponent {
  if (key === undefined) {
    throw new Error('content must have key.');
  }
  if (uiSchemaKeyIsParentKey(key)) {
    throw new Error('cannot convert parent key to data path component.');
  }
  return toMapKeyDataPathComponent(key);
}

export function getChildDataModelByUISchemaKey(
  model: MapDataModel | undefined,
  key: UISchemaKey | undefined,
): DataModel | undefined {
  if (model === undefined || key === undefined || uiSchemaKeyIsParentKey(key)) {
    return undefined;
  }
  return getMapDataAtPathComponent(model, stringUISchemaKeyToDataPathComponent(key));
}

// export function uiModelDataPathContextEquals(
//   lhs: UIModelDataPathContext | undefined,
//   rhs: UIModelDataPathContext | undefined,
// ): boolean {
//   if (lhs === undefined || rhs === undefined) {
//     return lhs === rhs;
//   }
//   if (lhs.isKey) {
//     return !!rhs.isKey && lhs.key === rhs.key && forwardDataPathEquals(lhs.parentPath, rhs.parentPath);
//   } else {
//     return (
//       !rhs.isKey &&
//       forwardDataPathEquals(lhs.parentPath, rhs.parentPath) &&
//       forwardDataPathComponentEquals(lhs.self, rhs.self)
//     );
//   }
// }
