import {ContentListIndex, UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  ForwardDataPath,
  headDataPathComponentOrUndefined,
  pushDataPath,
  safeShiftDataPath,
  toPointerPathComponent,
} from '../DataModel/DataPath';
import {UISchemaContext} from './UISchemaContext';
import {
  dataModelIsList,
  dataModelIsMap,
  dataModelIsString,
  getIdFromDataPointer,
  getListDataAt,
  getListDataIndexByPathComponent,
  getListDataIndexForPointer,
  getListDataPointerAt,
  getMapDataAtIndex,
  getMapDataIndexByPathComponent,
  getMapDataIndexForPointer,
  getMapDataPointerAtIndex,
  getMapKeyAtIndex,
  listDataSize,
  mapDataSize,
  mapListDataModelWithPointer,
  mapMapDataModelWithPointer,
  nullableStringToDataModel,
  stringDataModelToString,
} from '../DataModel/DataModel';
import {dataSchemaIsMap, DataSchemaType} from '../DataModel/DataSchema';
import {
  buildDataPathFromUIModelDataPathContext,
  getChildDataModelByUISchemaKey,
  makeKeyUIModelDataPathContext,
  stringUISchemaKeyToDataPathComponent,
  UIModelDataPathContext,
  uiSchemaKeyToDataPathComponent,
} from './DataPathContext';
import {uiSchemaKeyIsParentKey} from './UISchema';
import {fillTemplateLine} from '../DataModel/TemplateEngine';

export function buildUIModel(
  uiSchemaContext: UISchemaContext,
  dataModel: DataModel | undefined,
  dataPathContext: UIModelDataPathContext | undefined,
  dataPathFocus: ForwardDataPath | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
): UIModel {
  // TODO 古いuiModelを引数に入れ、変化がなければ古いuiModelを返して無駄にオブジェクトを生成しない様にする修正

  const {currentSchema} = uiSchemaContext;
  switch (currentSchema.type) {
    case 'tab': {
      const firstPathComponent = headDataPathComponentOrUndefined(dataPathFocus);
      const currentContentIndex =
        uiSchemaContext.contentIndexForDataPathComponent(firstPathComponent, dataModel) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const childDataModel = childContext.currentSchema.keyFlatten
        ? dataModel
        : getChildDataModelByUISchemaKey(dataModel, childContext.currentSchema.key);
      const childPathContext = uiSchemaKeyIsParentKey(childContext.currentSchema.key)
        ? makeKeyUIModelDataPathContext(dataPathContext)
        : childContext.currentSchema.keyFlatten
        ? dataPathContext && {
            parentPath: dataPathContext.parentPath,
            self: stringUISchemaKeyToDataPathComponent(childContext.currentSchema.key),
          }
        : {parentPath: dataPath, self: stringUISchemaKeyToDataPathComponent(childContext.currentSchema.key)};
      return {
        type: 'tab',
        schema: currentSchema,
        dataPath,
        currentTabIndex: currentContentIndex,
        tabs: uiSchemaContext.contents().map((content) => ({
          label: content.currentSchema.dataSchema.label ?? '',
          dataPath: pushDataPath(dataPath, uiSchemaKeyToDataPathComponent(content.currentSchema.key)),
        })),
        currentChild: buildUIModel(
          childContext,
          childDataModel,
          childPathContext,
          childContext.currentSchema.keyFlatten ? dataPathFocus : safeShiftDataPath(dataPathFocus),
          dataFocusLog?.c[currentContentIndex],
          schemaFocusLog?.c[currentContentIndex],
        ),
      };
    }

    case 'form': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      return {
        type: 'form',
        schema: currentSchema,
        dataPath,
        // contentsにはDataModelを渡してコールバックの引数にdataPointerを渡せる様にすべきか？
        // => selfをDataPointerにすべきかと思って上記を書いたけど、そんなことはないか。
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const childDataModel = contentContext.currentSchema.keyFlatten
            ? dataModel
            : getChildDataModelByUISchemaKey(dataModel, contentContext.currentSchema.key);
          const childPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
            ? makeKeyUIModelDataPathContext(dataPathContext)
            : contentContext.currentSchema.keyFlatten
            ? dataPathContext && {
                parentPath: dataPathContext.parentPath,
                self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
              }
            : {parentPath: dataPath, self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key)};
          return {
            model: buildUIModel(
              contentContext,
              childDataModel,
              childPathContext,
              contentContext.currentSchema.keyFlatten ? dataPathFocus : safeShiftDataPath(dataPathFocus),
              dataFocusLog?.c[index],
              schemaFocusLog?.c[index],
            ),
            label: contentContext.currentSchema.dataSchema.label ?? '',
          };
        }),
      };
    }

    case 'contentList': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const contentContext = uiSchemaContext.content();
      let indexes: ContentListIndex[];
      const focusPathComponent = dataPathFocus && headDataPathComponentOrUndefined(dataPathFocus);
      const modelBase = {type: 'contentList', dataPath, schema: currentSchema} as const;
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        // TODO FixedMap対応だけではダメ
        const itemDataSchema =
          currentSchema.dataSchema.item?.t === DataSchemaType.FixedMap ? currentSchema.dataSchema.item : undefined;
        const mapDataModel = dataModelIsMap(dataModel) ? dataModel : undefined;
        if (mapDataModel) {
          indexes = mapMapDataModelWithPointer(mapDataModel, (item, pointer, key) => {
            const childDataPath = pushDataPath(dataPath, toPointerPathComponent(pointer));
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, childDataPath, key ?? undefined, {})
                : [key ?? undefined],
              pointer,
              dataPath: childDataPath,
            };
          });

          let currentIndex =
            focusPathComponent === undefined
              ? dataFocusLog?.a && getMapDataIndexForPointer(mapDataModel, dataFocusLog.a)
              : getMapDataIndexByPathComponent(mapDataModel, focusPathComponent);
          if (currentIndex === undefined && mapDataModel && mapDataSize(mapDataModel) > 0) {
            // default index is 0
            currentIndex = 0;
          }
          if (currentIndex !== undefined) {
            const pointer = getMapDataPointerAtIndex(mapDataModel, currentIndex);
            const key = getMapKeyAtIndex(mapDataModel, currentIndex);
            if (pointer) {
              const contentData = getMapDataAtIndex(mapDataModel, currentIndex);
              const content = buildUIModel(
                contentContext,
                contentData,
                {parentPath: dataPath, self: toPointerPathComponent(pointer), key},
                safeShiftDataPath(dataPathFocus),
                dataFocusLog?.c[getIdFromDataPointer(pointer)],
                schemaFocusLog,
              );
              return {...modelBase, indexes, currentIndex, content};
            }
          }
        } else {
          indexes = [];
        }
      } else {
        const listDataModel = dataModelIsList(dataModel) ? dataModel : undefined;
        if (dataModelIsList(listDataModel)) {
          // TODO FixedMap対応だけではダメ
          const itemDataSchema =
            currentSchema.dataSchema.item?.t === DataSchemaType.FixedMap ? currentSchema.dataSchema.item : undefined;

          indexes = mapListDataModelWithPointer(listDataModel, (item, pointer, index) => {
            const childDataPath = pushDataPath(dataPath, toPointerPathComponent(pointer));
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, childDataPath, index, {})
                : [index.toString()],
              pointer,
              dataPath: childDataPath,
            };
          });

          let currentIndex =
            focusPathComponent === undefined
              ? dataFocusLog?.a && getListDataIndexForPointer(listDataModel, dataFocusLog.a)
              : getListDataIndexByPathComponent(listDataModel, focusPathComponent);
          if (currentIndex === undefined && listDataModel && listDataSize(listDataModel) > 0) {
            // default index is 0
            currentIndex = 0;
          }
          if (currentIndex !== undefined) {
            const pointer = getListDataPointerAt(listDataModel, currentIndex);
            if (pointer) {
              const contentData = getListDataAt(listDataModel, currentIndex);
              const content = buildUIModel(
                contentContext,
                contentData,
                {parentPath: dataPath, self: toPointerPathComponent(pointer)},
                safeShiftDataPath(dataPathFocus),
                dataFocusLog?.c?.[getIdFromDataPointer(pointer)],
                schemaFocusLog,
              );
              return {...modelBase, indexes, currentIndex, content};
            }
          }
        } else {
          indexes = [];
        }
      }
      return {...modelBase, indexes};
    }

    case 'text': {
      if (dataPathContext?.isKey) {
        return {
          type: 'text',
          isKey: true,
          parentDataPath: dataPathContext.parentPath,
          selfPointer: dataPathContext.selfPointer,
          value: nullableStringToDataModel(dataPathContext.key),
        };
      } else {
        const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
        const value = dataModel !== undefined && dataModelIsString(dataModel) && stringDataModelToString(dataModel);
        return {type: 'text', schema: currentSchema, dataPath, value: value || ''};
      }
    }
  }
}
