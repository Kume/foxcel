import {ContentListIndex, MappingTableUIModelRow, SelectUIModel, TableUIModelRow, UIModel} from './UIModelTypes';
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
  dataModelEqualsToUnknown,
  dataModelIsBoolean,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsNumber,
  dataModelIsString,
  dataPointerIdEquals,
  eachMapDataItem,
  findMapDataIndexOfKey,
  getIdFromDataPointer,
  getListDataAt,
  getListDataIndexByPathComponent,
  getListDataIndexForPointer,
  getListDataPointerAt,
  getMapDataAtIndex,
  getMapDataAtPointer,
  getMapDataIndexByPathComponent,
  getMapDataIndexForPointer,
  getMapDataPointerAtIndex,
  getMapKeyAtIndex,
  listDataSize,
  mapDataSize,
  mapListDataModelWithPointer,
  mapMapDataModel,
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
import {stringUISchemaKeyToString, uiSchemaKeyIsParentKey} from './UISchema';
import {fillTemplateLine} from '../DataModel/TemplateEngine';
import {
  DataModelContext,
  DataModelRoot,
  pushDataModelContextPath,
  pushMapDataModelContextPath,
  pushPointerToDataModelContext,
  pushUiSchemaKeyToDataModelContext,
  undefinedDataModelContextPathComponent,
} from '../DataModel/DataModelContext';
import {findDataModel} from '../DataModel/DataModelSearcher';
import {formatDynamicSelectUIOption} from './SelectUIModel';
import {getDataModelBySinglePath} from '../DataModel/DataModelCollector';

function getMapChildContextForFlattenable(
  childContext: UISchemaContext,
  dataPathContext: UIModelDataPathContext | undefined,
  dataPath: ForwardDataPath,
  dataModelContext: DataModelContext,
  dataModel: DataModel | undefined,
  mapDataModelOrUndefined: MapDataModel | undefined,
): [DataModel | undefined, UIModelDataPathContext | undefined, DataModelContext] {
  if (uiSchemaKeyIsParentKey(childContext.currentSchema.key)) {
    return [
      undefined,
      makeKeyUIModelDataPathContext(dataPathContext),
      pushMapDataModelContextPath(dataModelContext, dataModel, undefined),
    ];
  } else {
    if (childContext.currentSchema.keyFlatten) {
      return [dataModel, dataPathContext, dataModelContext];
    } else {
      return [
        getChildDataModelByUISchemaKey(mapDataModelOrUndefined, childContext.currentSchema.key),
        {parentPath: dataPath, self: stringUISchemaKeyToDataPathComponent(childContext.currentSchema.key)},
        pushMapDataModelContextPath(
          dataModelContext,
          dataModel,
          stringUISchemaKeyToString(childContext.currentSchema.key),
        ),
      ];
    }
  }
}

export function buildUIModel(
  uiSchemaContext: UISchemaContext,
  dataModel: DataModel | undefined,
  oldModel: UIModel | undefined,
  dataPathContext: UIModelDataPathContext | undefined,
  dataContext: DataModelContext,
  dataRoot: DataModelRoot,
  dataPathFocus: ForwardDataPath | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
): UIModel {
  const {currentSchema} = uiSchemaContext;

  /** まだキャッシュは正しく動かないのでコメントアウトしておく
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
   **/

  switch (currentSchema.type) {
    case 'tab': {
      const firstPathComponent = headDataPathComponentOrUndefined(dataPathFocus);
      const currentContentIndex =
        uiSchemaContext.contentIndexForDataPathComponent(firstPathComponent, dataModel) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const [childDataModel, childPathContext, nextDataModelContext] = getMapChildContextForFlattenable(
        childContext,
        dataPathContext,
        dataPath,
        dataContext,
        dataModel,
        mapDataModelOrUndefined,
      );
      return {
        type: 'tab',
        schema: currentSchema,
        dataPath,
        dataContext,
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
          nextDataModelContext,
          dataRoot,
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
        dataContext,
        data: mapDataModelOrUndefined,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        // contentsにはDataModelを渡してコールバックの引数にdataPointerを渡せる様にすべきか？
        // => selfをDataPointerにすべきかと思って上記を書いたけど、そんなことはないか。
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const [childDataModel, childPathContext, nextDataModelContext] = getMapChildContextForFlattenable(
            contentContext,
            dataPathContext,
            dataPath,
            dataContext,
            dataModel,
            mapDataModelOrUndefined,
          );
          return {
            model: buildUIModel(
              contentContext,
              childDataModel,
              oldModel?.type === 'form' ? oldModel.contents[index].model : undefined,
              childPathContext,
              nextDataModelContext,
              dataRoot,
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
            const rowDataContext = pushMapDataModelContextPath(dataContext, dataModel, key);
            if (
              oldRow &&
              oldRow.key === key &&
              schemaFocusLogEquals &&
              rowMapDataOrUndefined === oldRow.data &&
              rowDataFocusLog === oldRow.dataFocusLog &&
              forwardDataPathEquals(rowDataPathFocus, oldRow.dataPathFocus)
            ) {
              return oldRow;
            } else {
              return {
                pointer,
                key,
                data: rowMapDataOrUndefined,
                dataPath: rowDataPath,
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  const cellPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? ({parentPath: dataPath, isKey: true, key, selfPointer: pointer} as const)
                    : {
                        parentPath: rowDataPath,
                        self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
                      };
                  const cellDataModelContext = pushUiSchemaKeyToDataModelContext(
                    rowDataContext,
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  return buildUIModel(
                    contentContext,
                    cellData,
                    oldRow?.cells[index],
                    cellPathContext,
                    cellDataModelContext,
                    dataRoot,
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
            const rowDataContext = pushPointerToDataModelContext(dataContext, dataModel, pointer);
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
                key: undefined,
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
                  const cellDataContext = pushUiSchemaKeyToDataModelContext(
                    rowDataContext,
                    rowData,
                    contentContext.currentSchema.key,
                  );
                  return buildUIModel(
                    contentContext,
                    cellData,
                    oldRow?.cells[index],
                    childPathContext,
                    cellDataContext,
                    dataRoot,
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
        dataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
      };
    }

    case 'mappingTable': {
      const mapOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const referenceData = getDataModelBySinglePath(mapOrUndefined, currentSchema.sourcePath, dataContext, dataRoot);
      const oldTableModel = oldModel?.type === 'mappingTable' ? oldModel : undefined;
      let rows: readonly MappingTableUIModelRow[];
      const danglingRows: TableUIModelRow[] = [];
      if (dataModelIsMap(referenceData)) {
        if (mapOrUndefined) {
          const oldRowsById = new Map<number, MappingTableUIModelRow>();
          if (oldTableModel) {
            for (const oldRow of oldTableModel?.rows) {
              if (!oldRow.isEmpty) {
                oldRowsById.set(getIdFromDataPointer(oldRow.pointer), oldRow);
              }
            }
          }
          const oldDanglingRowsById = new Map(
            oldTableModel?.danglingRows.map((row) => [getIdFromDataPointer(row.pointer), row]),
          );
          const mappedKeys = new Set<string | null>();
          rows = mapMapDataModel(
            referenceData,
            (sourceRowData, key): MappingTableUIModelRow => {
              const rowMapDataIndex = key === null ? undefined : findMapDataIndexOfKey(mapOrUndefined, key);
              const rowDataContext = pushMapDataModelContextPath(dataContext, mapOrUndefined, key);
              if (rowMapDataIndex === undefined) {
                return {
                  isEmpty: true,
                  key,
                  cells: uiSchemaContext.contents().map((contentContext) => {
                    if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                      // TODO エラーハンドリング
                      throw new Error('mapping tableの中に$key指定の要素が含まれていてはならない。');
                    } else if (contentContext.currentSchema.key === undefined) {
                      // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                      throw new Error('mapping tableの要素はkey指定を省略不可');
                    }
                    return {
                      schema: contentContext.currentSchema,
                      key: contentContext.currentSchema.key,
                      dataContext: pushDataModelContextPath(rowDataContext, undefinedDataModelContextPathComponent),
                    };
                  }),
                };
              }
              mappedKeys.add(key);
              // findMapDataIndexOfKeyで手に入れたindexなのでpointerは必ず取得できる
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const pointer = getMapDataPointerAtIndex(mapOrUndefined, rowMapDataIndex)!;
              const rowData = getMapDataAtPointer(mapOrUndefined, pointer);
              const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
              const id = getIdFromDataPointer(pointer);
              const pointerPathComponent = toPointerPathComponent(pointer);
              const rowDataFocusLog = dataFocusLog?.c[id];
              const rowDataPath = pushDataPath(dataPath, pointerPathComponent);
              const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
              const oldRow_ = oldRowsById.get(id);
              const oldRow = oldRow_?.isEmpty ? undefined : oldRow_;
              if (
                oldRow &&
                oldRow.key === key &&
                oldTableModel &&
                schemaFocusLog === oldTableModel.schemaFocusLog &&
                rowMapDataOrUndefined === oldRow.data &&
                rowDataFocusLog === oldRow.dataFocusLog &&
                forwardDataPathEquals(rowDataPathFocus, oldRow.dataPathFocus)
              ) {
                return oldRow;
              } else {
                return {
                  pointer,
                  key,
                  data: rowMapDataOrUndefined,
                  dataPath: rowDataPath,
                  dataPathFocus: rowDataPathFocus,
                  dataFocusLog: rowDataFocusLog,
                  cells: uiSchemaContext.contents().map((contentContext, index) => {
                    const cellData = getChildDataModelByUISchemaKey(
                      rowMapDataOrUndefined,
                      contentContext.currentSchema.key,
                    );
                    const cellPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                      ? ({parentPath: dataPath, isKey: true, key, selfPointer: pointer} as const)
                      : {
                          parentPath: rowDataPath,
                          self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
                        };
                    const cellDataModelContext = pushUiSchemaKeyToDataModelContext(
                      rowDataContext,
                      rowMapDataOrUndefined,
                      contentContext.currentSchema.key,
                    );
                    return buildUIModel(
                      contentContext,
                      cellData,
                      oldRow?.cells[index],
                      cellPathContext,
                      cellDataModelContext,
                      dataRoot,
                      safeShiftDataPath(rowDataPathFocus),
                      rowDataFocusLog?.c[index],
                      schemaFocusLog?.c[index],
                    );
                  }),
                };
              }
            },
          );
          for (const [rowData, pointer, key] of eachMapDataItem(mapOrUndefined)) {
            if (mappedKeys.has(key)) {
              continue;
            }
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const pointerPathComponent = toPointerPathComponent(pointer);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPath = pushDataPath(dataPath, pointerPathComponent);
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
            const rowDataContext = pushMapDataModelContextPath(dataContext, mapOrUndefined, key);
            const oldRow = oldDanglingRowsById.get(id);
            if (
              oldRow &&
              oldRow.key === key &&
              oldTableModel &&
              schemaFocusLog === oldTableModel.schemaFocusLog &&
              rowMapDataOrUndefined === oldRow.data &&
              rowDataFocusLog === oldRow.dataFocusLog &&
              forwardDataPathEquals(rowDataPathFocus, oldRow.dataPathFocus)
            ) {
              danglingRows.push(oldRow);
            } else {
              danglingRows.push({
                pointer,
                key,
                data: rowMapDataOrUndefined,
                dataPath: rowDataPath,
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  const cellPathContext = uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? ({parentPath: dataPath, isKey: true, key, selfPointer: pointer} as const)
                    : {
                        parentPath: rowDataPath,
                        self: stringUISchemaKeyToDataPathComponent(contentContext.currentSchema.key),
                      };
                  const cellDataModelContext = pushUiSchemaKeyToDataModelContext(
                    rowDataContext,
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  return buildUIModel(
                    contentContext,
                    cellData,
                    oldRow?.cells[index],
                    cellPathContext,
                    cellDataModelContext,
                    dataRoot,
                    safeShiftDataPath(rowDataPathFocus),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }),
              });
            }
          }
        } else {
          rows = mapMapDataModel(referenceData, (rowData, key) => {
            const rowDataContext = pushMapDataModelContextPath(dataContext, mapOrUndefined, key);
            return {
              isEmpty: true,
              key,
              cells: uiSchemaContext.contents().map((contentContext) => {
                // TODO 共通化
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  // TODO エラーハンドリング
                  throw new Error('mapping tableの中に$key指定の要素が含まれていてはならない。');
                } else if (contentContext.currentSchema.key === undefined) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableの要素はkey指定を省略不可');
                }
                return {
                  schema: contentContext.currentSchema,
                  key: contentContext.currentSchema.key,
                  dataContext: pushDataModelContextPath(rowDataContext, undefinedDataModelContextPathComponent),
                };
              }),
            };
          });
        }
      } else {
        rows = [];
      }
      return {
        type: 'mappingTable',
        schema: currentSchema,
        data: mapOrUndefined,
        dataPath,
        dataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
        danglingRows,
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
        dataContext,
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
            const childDataContext = pushPointerToDataModelContext(dataContext, mapDataModel, pointer);
            const childDataPath = pushDataPath(dataPath, toPointerPathComponent(pointer));
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, childDataContext, dataRoot)
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
                pushPointerToDataModelContext(dataContext, mapDataModel, pointer),
                dataRoot,
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
            const childDataContext = pushPointerToDataModelContext(dataContext, listDataModel, pointer);
            const childDataPath = pushDataPath(dataPath, toPointerPathComponent(pointer));
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, childDataContext, dataRoot)
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
                pushPointerToDataModelContext(dataContext, listDataModel, pointer),
                dataRoot,
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
          dataContext,
          dataPathFocus,
          dataFocusLog,
          schemaFocusLog,
          // TODO dataModelをプロパティとして持つなら、value不要っぽい
          value: value || '',
        };
      }
    }

    case 'number': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      const numberData = dataModelIsNumber(dataModel) ? dataModel : undefined;
      return {
        type: 'number',
        schema: currentSchema,
        data: numberData,
        dataPath,
        dataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'checkbox': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      return {
        type: 'checkbox',
        schema: currentSchema,
        data: dataModelIsBoolean(dataModel) ? dataModel : undefined,
        dataPath,
        dataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'select': {
      const dataPath = buildDataPathFromUIModelDataPathContext(dataPathContext, currentSchema);
      let current: SelectUIModel['current'];
      if (dataModel) {
        for (const option of currentSchema.options) {
          if (option.label === undefined) {
            // Dynamic option
            const findResult = findDataModel(
              dataModel,
              // TODO matcherは暫定対応なので、後でちゃんと実装する
              {path: option.path, matcher: {type: 'equal', operand1: option.valuePath, operand2: dataModel}},
              dataContext,
              dataRoot,
              {} as any, // TODO ちゃんとログの仕組みを整える
            );
            if (findResult) {
              current = formatDynamicSelectUIOption(option, findResult.data, findResult.context, dataRoot);
              break;
            }
          } else {
            // Static option
            if (dataModelEqualsToUnknown(dataModel, option.value)) {
              current = {label: option.label, value: option.value.toString(), data: dataModel};
              break;
            }
          }
        }
      }
      return {
        type: 'select',
        schema: currentSchema,
        data: dataModel,
        dataPath,
        dataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        current,
      };
    }
  }
}
