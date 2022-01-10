import {ContentListIndex, TableUIModelRow, UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModel, ListDataModel, MapDataModel} from '../DataModel/DataModelTypes';
import {
  ForwardDataPath,
  forwardDataPathEquals,
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
  dataPointerIdEquals,
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
  oldModel: UIModel | undefined,
  dataPathContext: UIModelDataPathContext | undefined,
  dataPathFocus: ForwardDataPath | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
): UIModel {
  const {currentSchema} = uiSchemaContext;

  if (oldModel) {
    if (oldModel.isKey) {
      if (
        dataPathContext?.isKey &&
        forwardDataPathEquals(dataPathContext.parentPath, oldModel.parentDataPath) &&
        dataPathContext.key === oldModel.value
      ) {
        return oldModel;
      }
    } else {
      if (
        dataModel === oldModel.data &&
        dataFocusLog === oldModel.dataFocusLog &&
        schemaFocusLog === oldModel.schemaFocusLog &&
        forwardDataPathEquals(dataPathFocus, oldModel.dataPathFocus) &&
        currentSchema === oldModel.schema
        // DataPathContextの異なるmodelは呼び出し元でundefinedにするためここでは比較しない
        // !dataPathContext?.isKey &&
        // forwardDataPathEquals(
        //   buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema),
        //   oldModel.dataPath,
        // )
      ) {
        return oldModel;
      }
    }
  }

  switch (currentSchema.type) {
    case 'tab': {
      const firstPathComponent = headDataPathComponentOrUndefined(dataPathFocus);
      const currentContentIndex =
        uiSchemaContext.contentIndexForDataPathComponent(firstPathComponent, dataModel) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const childDataModel = childContext.currentSchema.keyFlatten
        ? dataModel
        : getChildDataModelByUISchemaKey(mapDataModelOrUndefined, childContext.currentSchema.key);
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
        data: mapDataModelOrUndefined,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        currentTabIndex: currentContentIndex,
        tabs: uiSchemaContext.contents().map((content) => ({
          label: content.currentSchema.dataSchema.label ?? '',
          dataPath: pushDataPath(dataPath, uiSchemaKeyToDataPathComponent(content.currentSchema.key)),
        })),
        currentChild: buildUIModel(
          childContext,
          childDataModel,
          oldModel?.type === 'tab' && currentContentIndex === oldModel.currentTabIndex
            ? oldModel.currentChild
            : undefined,
          childPathContext,
          childContext.currentSchema.keyFlatten ? dataPathFocus : safeShiftDataPath(dataPathFocus),
          dataFocusLog?.c[currentContentIndex],
          schemaFocusLog?.c[currentContentIndex],
        ),
      };
    }

    case 'form': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      return {
        type: 'form',
        schema: currentSchema,
        dataPath,
        data: mapDataModelOrUndefined,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        // contentsにはDataModelを渡してコールバックの引数にdataPointerを渡せる様にすべきか？
        // => selfをDataPointerにすべきかと思って上記を書いたけど、そんなことはないか。
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const childDataModel = contentContext.currentSchema.keyFlatten
            ? mapDataModelOrUndefined
            : getChildDataModelByUISchemaKey(mapDataModelOrUndefined, contentContext.currentSchema.key);
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
              oldModel?.type === 'form' ? oldModel.contents[index].model : undefined,
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

    case 'table': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      let mapOrListDataOrUndefined: MapDataModel | ListDataModel | undefined;
      const oldTableModel = oldModel?.type === 'table' ? oldModel : undefined;
      const oldRowsById = new Map(oldTableModel?.rows.map((row) => [getIdFromDataPointer(row.pointer), row]) ?? []);
      const schemaFocusLogEquals = oldTableModel && schemaFocusLog === oldTableModel.schemaFocusLog;
      let rows: readonly TableUIModelRow[];
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        if (dataModelIsMap(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapMapDataModelWithPointer(dataModel, (rowData, pointer, key) => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const pointerPathComponent = toPointerPathComponent(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPath = pushDataPath(dataPath, pointerPathComponent);
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
            if (
              oldRow &&
              schemaFocusLogEquals &&
              rowMapDataOrUndefined === oldRow.data &&
              rowDataFocusLog === oldRow.dataFocusLog &&
              forwardDataPathEquals(rowDataPathFocus, oldRow.dataPathFocus)
            ) {
              return oldRow;
            } else {
              return {
                pointer,
                data: rowMapDataOrUndefined,
                dataPath: rowDataPath,
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    dataModelIsMap(rowData) ? rowData : undefined,
                    contentContext.currentSchema.key,
                  );
                  const childPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? ({parentPath: dataPath, isKey: true, key, selfPointer: pointer} as const)
                    : {
                        parentPath: rowDataPath,
                        self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
                      };
                  return buildUIModel(
                    contentContext,
                    cellData,
                    oldRow?.cells[index],
                    childPathContext,
                    safeShiftDataPath(rowDataPathFocus),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }),
              };
            }
          });
        } else {
          rows = [];
        }
      } else {
        if (dataModelIsList(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapListDataModelWithPointer(dataModel, (rowData, pointer) => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const pointerPathComponent = toPointerPathComponent(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPath = pushDataPath(dataPath, pointerPathComponent);
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
            if (
              oldRow &&
              schemaFocusLogEquals &&
              rowMapDataOrUndefined === oldRow.data &&
              rowDataFocusLog === oldRow.dataFocusLog &&
              forwardDataPathEquals(rowDataPathFocus, oldRow.dataPathFocus)
            ) {
              return oldRow;
            } else {
              return {
                pointer,
                data: rowMapDataOrUndefined,
                dataPath: rowDataPath,
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  const childPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? ({parentPath: dataPath, isKey: true, key: index.toString(), selfPointer: pointer} as const)
                    : {
                        parentPath: rowDataPath,
                        self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
                      };
                  return buildUIModel(
                    contentContext,
                    cellData,
                    oldRow?.cells[index],
                    childPathContext,
                    safeShiftDataPath(rowDataPathFocus),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }),
              };
            }
          });
        } else {
          rows = [];
        }
      }
      return {
        type: 'table',
        schema: currentSchema,
        data: mapOrListDataOrUndefined,
        dataPath,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
      };
    }

    case 'contentList': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const contentContext = uiSchemaContext.content();
      let indexes: ContentListIndex[];
      const focusPathComponent = dataPathFocus && headDataPathComponentOrUndefined(dataPathFocus);
      const modelBase = {
        type: 'contentList',
        dataPath,
        schema: currentSchema,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      } as const;
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
                oldModel?.type === 'contentList' && dataPointerIdEquals(pointer, oldModel.currentPointer)
                  ? oldModel.content
                  : undefined,
                {parentPath: dataPath, self: toPointerPathComponent(pointer), key},
                safeShiftDataPath(dataPathFocus),
                dataFocusLog?.c[getIdFromDataPointer(pointer)],
                schemaFocusLog,
              );
              return {...modelBase, data: mapDataModel, indexes, currentIndex, currentPointer: pointer, content};
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
                ? fillTemplateLine(itemDataSchema.dataLabel, item, childDataPath, index.toString(), {})
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
                oldModel?.type === 'contentList' && dataPointerIdEquals(pointer, oldModel.currentPointer)
                  ? oldModel.content
                  : undefined,
                {parentPath: dataPath, self: toPointerPathComponent(pointer)},
                safeShiftDataPath(dataPathFocus),
                dataFocusLog?.c?.[getIdFromDataPointer(pointer)],
                schemaFocusLog,
              );
              return {...modelBase, data: listDataModel, indexes, currentIndex, currentPointer: pointer, content};
            }
          }
        } else {
          indexes = [];
        }
      }
      return {...modelBase, data: undefined, indexes};
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
        const stringDataModel = dataModel !== undefined && dataModelIsString(dataModel) ? dataModel : undefined;
        const value = stringDataModel !== undefined ? stringDataModelToString(stringDataModel) : undefined;
        return {
          type: 'text',
          schema: currentSchema,
          data: stringDataModel,
          dataPath,
          dataPathFocus,
          dataFocusLog,
          schemaFocusLog,
          value: value || '',
        };
      }
    }
  }
}
