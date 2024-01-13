import {ContentListIndex, MappingTableUIModelRow, TableUIModelRow, UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModel, DataPointer, ListDataModel, MapDataModel} from '../DataModel/DataModelTypes';
import {
  EditingForwardDataPath,
  forwardDataPathEquals,
  headDataPathComponentOrUndefined,
  safeShiftDataPath,
} from '../DataModel/DataPath';
import {UISchemaContext} from './UISchemaContext';
import {
  dataModelIsBoolean,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsNumber,
  dataModelIsString,
  dataPointerIdEquals,
  eachMapDataItem,
  getMapDataIndexAt,
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
  mapMapDataModelWithPointer,
  stringDataModelToString,
} from '../DataModel/DataModel';
import {dataSchemaIsMap, DataSchemaType} from '../DataModel/DataSchema';
import {assertUISchemaKeyIsString, getChildDataModelByUISchemaKey} from './DataPathContext';
import {stringUISchemaKeyToString, uiSchemaKeyIsParentKey} from './UISchema';
import {fillTemplateLine} from '../DataModel/TemplateEngine';
import {DataModelContext, DataModelRoot} from '../DataModel/DataModelContext';
import {selectUIModelGetCurrent} from './SelectUIModel';
import {getDataModelBySinglePath} from '../DataModel/DataModelCollector';
import {UISchema} from './UISchemaTypes';

function getMapChildContextForFlattenable(
  childContext: UISchemaContext,
  dataContext: DataModelContext,
  dataModel: DataModel | undefined,
  mapDataModelOrUndefined: MapDataModel | undefined,
): [DataModel | undefined, DataModelContext] {
  if (uiSchemaKeyIsParentKey(childContext.currentSchema.key)) {
    return [undefined, dataContext.pushIsParentKey()];
  } else {
    if (childContext.currentSchema.keyFlatten) {
      return [dataModel, dataContext];
    } else {
      if (childContext.currentSchema.key === undefined) {
        throw new Error(`Current schema must have key`);
      }
      const mapKey = stringUISchemaKeyToString(childContext.currentSchema.key);
      return [
        getChildDataModelByUISchemaKey(mapDataModelOrUndefined, childContext.currentSchema.key),
        dataContext.pushMapIndexOrKey(mapKey),
      ];
    }
  }
}

export function buildUIModel(
  uiSchemaContext: UISchemaContext,
  dataModel: DataModel | undefined,
  oldModel: UIModel | undefined,
  dataContext: DataModelContext,
  dataRoot: DataModelRoot,
  dataPathFocus: EditingForwardDataPath | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
  // @ts-expect-error
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
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const [childDataModel, nextDataModelContext] = getMapChildContextForFlattenable(
        childContext,
        dataContext,
        dataModel,
        mapDataModelOrUndefined,
      );
      return {
        type: 'tab',
        schema: currentSchema,
        dataContext: dataContext.serialize(),
        data: mapDataModelOrUndefined,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        currentTabIndex: currentContentIndex,
        tabs: uiSchemaContext.contents().map((content) => ({
          label: content.currentSchema.dataSchema.label ?? '',
          dataContext: dataContext.pushMapKey(assertUISchemaKeyIsString(content.currentSchema.key)).serialize(),
        })),
        currentChild: buildUIModel(
          childContext,
          childDataModel,
          oldModel?.type === 'tab' && currentContentIndex === oldModel.currentTabIndex
            ? oldModel.currentChild
            : undefined,
          nextDataModelContext,
          dataRoot,
          childContext.currentSchema.keyFlatten ? dataPathFocus : safeShiftDataPath(dataPathFocus),
          dataFocusLog?.c[currentContentIndex],
          schemaFocusLog?.c[currentContentIndex],
        ),
      };
    }

    case 'form': {
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      return {
        type: 'form',
        schema: currentSchema,
        dataContext: dataContext.serialize(),
        data: mapDataModelOrUndefined,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        // contentsにはDataModelを渡してコールバックの引数にdataPointerを渡せる様にすべきか？
        // => selfをDataPointerにすべきかと思って上記を書いたけど、そんなことはないか。
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const [childDataModel, nextDataModelContext] = getMapChildContextForFlattenable(
            contentContext,
            dataContext,
            dataModel,
            mapDataModelOrUndefined,
          );
          return {
            model: buildUIModel(
              contentContext,
              childDataModel,
              oldModel?.type === 'form' ? oldModel.contents[index].model : undefined,
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
      let mapOrListDataOrUndefined: MapDataModel | ListDataModel | undefined;
      const oldTableModel = oldModel?.type === 'table' ? oldModel : undefined;
      const oldRowsById = new Map(oldTableModel?.rows.map((row) => [getIdFromDataPointer(row.pointer), row]) ?? []);
      const schemaFocusLogEquals = oldTableModel && schemaFocusLog === oldTableModel.schemaFocusLog;
      let rows: readonly TableUIModelRow[];
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        if (dataModelIsMap(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapMapDataModelWithPointer(dataModel, (rowData, pointer, key, index) => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);

            const rowDataContext = dataContext.pushMapIndex(index, key);
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
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                    return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                  } else {
                    if (contentContext.currentSchema.key === undefined) {
                      throw new Error(`Current schema must have key`);
                    }
                    return buildUIModel(
                      contentContext,
                      cellData,
                      oldRow?.cells[index],
                      rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                      dataRoot,
                      safeShiftDataPath(rowDataPathFocus),
                      rowDataFocusLog?.c[index],
                      schemaFocusLog?.c[index],
                    );
                  }
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
          rows = mapListDataModelWithPointer(dataModel, (rowData, pointer, index) => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
            const rowDataContext = dataContext.pushListIndex(index);
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
                dataPathFocus: rowDataPathFocus,
                dataFocusLog: rowDataFocusLog,
                cells: uiSchemaContext.contents().map((contentContext, index) => {
                  const cellData = getChildDataModelByUISchemaKey(
                    rowMapDataOrUndefined,
                    contentContext.currentSchema.key,
                  );
                  if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                    return buildUIModelForParentKey(
                      contentContext.currentSchema,
                      dataContext,
                      pointer,
                      index.toString(),
                    );
                  } else {
                    if (contentContext.currentSchema.key === undefined) {
                      throw new Error(`Current schema must have key`);
                    }
                    return buildUIModel(
                      contentContext,
                      cellData,
                      oldRow?.cells[index],
                      rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                      dataRoot,
                      safeShiftDataPath(rowDataPathFocus),
                      rowDataFocusLog?.c[index],
                      schemaFocusLog?.c[index],
                    );
                  }
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
        dataContext: dataContext.serialize(),
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
      };
    }

    case 'mappingTable': {
      const mapOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const referenceData = getDataModelBySinglePath(mapOrUndefined, currentSchema.sourcePath, dataContext, dataRoot);
      const rows: MappingTableUIModelRow[] = [];
      const danglingRows: TableUIModelRow[] = [];
      if (dataModelIsMap(referenceData)) {
        const mappedKeys = new Set<string>();
        if (mapOrUndefined) {
          for (const [, , key] of eachMapDataItem(referenceData)) {
            if (key === null || mappedKeys.has(key)) {
              continue;
            }
            mappedKeys.add(key);

            const rowMapDataIndex = getMapDataIndexAt(mapOrUndefined, key);
            if (rowMapDataIndex === undefined) {
              const rowDataContext = dataContext.pushMapKey(key);
              rows.push({
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
                    dataContext: rowDataContext
                      .pushMapKey(stringUISchemaKeyToString(contentContext.currentSchema.key))
                      .serialize(),
                  };
                }),
              });
              continue;
            }

            const rowDataContext = dataContext.pushMapIndex(rowMapDataIndex, key);
            // findMapDataIndexOfKeyで手に入れたindexなのでpointerは必ず取得できる
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const pointer = getMapDataPointerAtIndex(mapOrUndefined, rowMapDataIndex)!;
            const rowData = getMapDataAtPointer(mapOrUndefined, pointer);
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);

            rows.push({
              pointer,
              key,
              data: rowMapDataOrUndefined,
              dataPathFocus: rowDataPathFocus,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                const cellData = getChildDataModelByUISchemaKey(
                  rowMapDataOrUndefined,
                  contentContext.currentSchema.key,
                );
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                    throw new Error('mapping tableの要素はkey指定を省略不可');
                  }
                  return buildUIModel(
                    contentContext,
                    cellData,
                    undefined,
                    rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                    dataRoot,
                    safeShiftDataPath(rowDataPathFocus),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }
              }),
            });
          }
          for (const [rowData, pointer, key, index] of eachMapDataItem(mapOrUndefined)) {
            if (key === null || mappedKeys.has(key)) {
              continue;
            }
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = safeShiftDataPath(dataPathFocus);
            const rowDataContext = dataContext.pushMapIndex(index, key);

            danglingRows.push({
              pointer,
              key,
              data: rowMapDataOrUndefined,
              dataPathFocus: rowDataPathFocus,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                const cellData = getChildDataModelByUISchemaKey(
                  rowMapDataOrUndefined,
                  contentContext.currentSchema.key,
                );
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                    throw new Error('mapping tableの要素はkey指定を省略不可');
                  }
                  return buildUIModel(
                    contentContext,
                    cellData,
                    undefined,
                    rowDataContext.pushMapIndex(index, contentContext.currentSchema.key),
                    dataRoot,
                    safeShiftDataPath(rowDataPathFocus),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }
              }),
            });
          }
        } else {
          // 対応するデータは存在しないが、データモデル上仮想的に空の列データを持たせる必要がある。
          for (const [, , key] of eachMapDataItem(referenceData)) {
            if (key === null || mappedKeys.has(key)) {
              continue;
            }
            mappedKeys.add(key);
            const rowDataContext = dataContext.pushMapKey(key);
            rows.push({
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
                  dataContext: rowDataContext.pushMapKey(contentContext.currentSchema.key).serialize(),
                };
              }),
            });
          }
        }
      }
      return {
        type: 'mappingTable',
        schema: currentSchema,
        data: mapOrUndefined,
        dataContext: dataContext.serialize(),
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
        danglingRows,
      };
    }

    case 'contentList': {
      const contentContext = uiSchemaContext.content();
      let indexes: ContentListIndex[];
      const focusPathComponent = dataPathFocus && headDataPathComponentOrUndefined(dataPathFocus);
      const modelBase = {
        type: 'contentList',
        dataContext: dataContext.serialize(),
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
          indexes = mapMapDataModelWithPointer(mapDataModel, (item, pointer, key, index) => {
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, dataContext.pushMapIndex(index, key), dataRoot)
                : [key ?? undefined],
              pointer,
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
                dataContext.pushMapIndex(currentIndex, key),
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
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, item, dataContext.pushListIndex(index), dataRoot)
                : [index.toString()],
              pointer,
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
                dataContext.pushListIndex(currentIndex),
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
      const stringDataModel = dataModel !== undefined && dataModelIsString(dataModel) ? dataModel : undefined;
      const value = stringDataModel !== undefined ? stringDataModelToString(stringDataModel) : undefined;
      return {
        type: 'text',
        schema: currentSchema,
        data: stringDataModel,
        dataContext: dataContext.serialize(),
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
        // TODO dataModelをプロパティとして持つなら、value不要っぽい
        value: value || '',
      };
    }

    case 'number': {
      const numberData = dataModelIsNumber(dataModel) ? dataModel : undefined;
      return {
        type: 'number',
        schema: currentSchema,
        data: numberData,
        dataContext: dataContext.serialize(),
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'checkbox': {
      return {
        type: 'checkbox',
        schema: currentSchema,
        data: dataModelIsBoolean(dataModel) ? dataModel : undefined,
        dataContext: dataContext.serialize(),
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'select': {
      if (currentSchema.isMulti) {
        const listOrUndefined = dataModelIsList(dataModel) ? dataModel : undefined;
        return {
          type: 'select',
          isMulti: true,
          schema: currentSchema,
          data: listOrUndefined,
          dataContext: dataContext.serialize(),
          dataPathFocus,
          dataFocusLog,
          schemaFocusLog,
          currents: listOrUndefined
            ? mapListDataModelWithPointer(listOrUndefined, (item, pointer, index) => ({
                ...selectUIModelGetCurrent(currentSchema, item, dataContext, dataRoot),
                dataContext: dataContext.pushListIndex(index).serialize(),
              }))
            : [],
        };
      } else {
        return {
          type: 'select',
          schema: currentSchema,
          data: dataModel,
          dataContext: dataContext.serialize(),
          dataPathFocus,
          dataFocusLog,
          schemaFocusLog,
          current: selectUIModelGetCurrent(currentSchema, dataModel, dataContext, dataRoot),
        };
      }
    }

    case 'conditional': {
      // TODO DataModelContextにDataを追加すると実装しやすそう
    }
  }
}

export function buildUIModelForParentKey(
  schema: UISchema,
  parentDataContext: DataModelContext,
  selfPointer: DataPointer,
  value: string | null,
): UIModel {
  switch (schema.type) {
    case 'text':
      return {
        type: 'text',
        isKey: true,
        dataContext: parentDataContext.pushIsParentKey().serialize(),
        selfPointer,
        value,
      };
    default:
      throw new Error(`Invalid schema for parent key ui. ${schema.type}`);
  }
}
