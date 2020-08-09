import {UIModelPathComponent} from './UIModelCommon';
import {
  ReferenceUISchema,
  UISchema,
  UISchemaContext,
  uiSchemaHasFlattenDataPathComponent,
  uiSchemaKeyAndPathComponentIsMatch,
} from './UISchema';
import {
  DataModel,
  dataPathFirstComponent,
  dataPathLength,
  ForwardDataPath,
  getFromDataModelForPathComponent,
  conditionIsMatch,
  shiftDataPath,
  MultiDataPath,
  DataCollectionItem,
  emptyDataPath,
} from '..';
import {pushDataPath} from '../DataModel/DataPath';

export interface UIModelFocusNode {
  active?: UIModelPathComponent;
  children?: Map<UIModelPathComponent, UIModelFocusNode>;
}

function mapMap<K, T, R>(origin: Map<K, T>, mapper: (value: T, key: K) => R): Map<K, R> {
  const map = new Map();
  for (const [key, value] of origin) {
    map.set(key, mapper(value, key));
  }
  return map;
}

export function focusForUIModel(
  origin: UIModelFocusNode | undefined,
  targetPath: ForwardDataPath,
  uiSchemaContext: UISchemaContext,
  collectDataForPath: undefined | ((path: MultiDataPath) => DataCollectionItem[]),
  currentPath: ForwardDataPath = emptyDataPath,
): UIModelFocusNode {
  if (dataPathLength(targetPath) === 0) {
    return {};
  }
  const firstPathComponent = dataPathFirstComponent(targetPath);
  const resolvedSchema = uiManager.resolve(schema);
  switch (resolvedSchema.type) {
    case 'text':
    case 'checkbox':
    case 'number':
    case 'select': {
      return {};
    }
    case 'tab':
    case 'form': {
      let childUiSchemaIndex = resolvedSchema.contents.findIndex((content) =>
        uiSchemaKeyAndPathComponentIsMatch(uiManager.resolve(content).key, firstPathComponent),
      );
      const childOrigin = origin?.children?.get(childUiSchemaIndex);
      const childModel = dataModel && getFromDataModelForPathComponent(dataModel, firstPathComponent);
      if (childUiSchemaIndex >= 0) {
        const childUiSchema = resolvedSchema.contents[childUiSchemaIndex];
        return {
          active: childUiSchemaIndex,
          children:
            dataPathLength(targetPath) === 1
              ? undefined
              : new Map([
                  ...(origin?.children ? origin.children : []),
                  [
                    childUiSchemaIndex,
                    focusForUIModel(
                      childOrigin,
                      shiftDataPath(targetPath),
                      childModel,
                      childUiSchema,
                      uiManager,
                      collectDataForPath,
                      pushDataPath(currentPath, firstPathComponent),
                    ),
                  ],
                ]),
        };
      } else {
        childUiSchemaIndex = resolvedSchema.contents.findIndex((content) =>
          uiSchemaHasFlattenDataPathComponent(content, firstPathComponent, uiManager),
        );
        if (childUiSchemaIndex >= 0) {
          const childUiSchema = resolvedSchema.contents[childUiSchemaIndex];
          return {
            active: childUiSchemaIndex,
            children: new Map([
              ...(origin?.children ? origin.children : []),
              [
                childUiSchemaIndex,
                focusForUIModel(
                  childOrigin,
                  targetPath,
                  childModel,
                  childUiSchema,
                  uiManager,
                  collectDataForPath,
                  currentPath,
                ),
              ],
            ]),
          };
        }
      }
      return {};
    }
    case 'conditional': {
      for (const key of Object.keys(resolvedSchema.contents)) {
        const conditionalItem = resolvedSchema.contents[key];
        if (conditionIsMatch(conditionalItem.condition, collectDataForPath)) {
        }
      }
    }
    default:
      return {};
  }
}
