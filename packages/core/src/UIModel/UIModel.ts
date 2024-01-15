import {
  ContentListIndex,
  ContentListUIModel,
  MappingTableUIModelRow,
  SelectUIModel,
  TableUIModelRow,
  UIModel,
} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataPointer, ListDataModel, MapDataModel} from '../DataModel/DataModelTypes';
import {UISchemaContext} from './UISchemaContext';
import {
  dataModelIsBoolean,
  dataModelIsList,
  dataModelIsMap,
  dataModelIsNumber,
  dataModelIsString,
  dataPointerIdEquals,
  eachMapDataItem,
  getIdFromDataPointer,
  getListDataIndexForPointer,
  getListDataPointerAt,
  getMapDataAtPointer,
  getMapDataIndexAt,
  getMapDataIndexForPointer,
  getMapDataPointerAtIndex,
  getMapKeyAtIndex,
  listDataSize,
  mapDataSize,
  mapListDataModelWithPointer,
  mapMapDataModelWithPointer,
  PathContainer,
  stringDataModelToString,
} from '../DataModel/DataModel';
import {dataSchemaIsMap, DataSchemaType} from '../DataModel/DataSchema';
import {assertUISchemaKeyIsString} from './DataPathContext';
import {stringUISchemaKeyToString, uiSchemaKeyIsParentKey} from './UISchema';
import {fillTemplateLine} from '../DataModel/TemplateEngine';
import {DataModelContext} from '../DataModel/DataModelContext';
import {selectUIModelGetCurrent} from './SelectUIModel';
import {getDataModelBySinglePath} from '../DataModel/DataModelCollector';
import {UISchema} from './UISchemaTypes';

function getMapChildContextForFlattenable(
  childContext: UISchemaContext,
  dataContext: DataModelContext,
): DataModelContext {
  if (uiSchemaKeyIsParentKey(childContext.currentSchema.key)) {
    return dataContext.pushIsParentKey();
  } else {
    if (childContext.currentSchema.keyFlatten) {
      return dataContext;
    } else {
      if (childContext.currentSchema.key === undefined) {
        throw new Error(`Current schema must have key`);
      }
      return dataContext.pushMapIndexOrKey(stringUISchemaKeyToString(childContext.currentSchema.key));
    }
  }
}

export function buildUIModel(
  uiSchemaContext: UISchemaContext,
  oldModel: UIModel | undefined,
  dataContext: DataModelContext,
  dataPathFocus: PathContainer | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
): UIModel {
  const {currentSchema} = uiSchemaContext;
  dataContext.assertAutoResolveConditional(false);

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
      const dataModel = dataContext.currentModel;
      const focusedKey = dataModelIsMap(dataModel) ? dataPathFocus?.mapChild(dataModel)?.[1] : undefined;
      const currentContentIndex = uiSchemaContext.contentsIndexForKey(focusedKey) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const nextDataModelContext = getMapChildContextForFlattenable(childContext, dataContext);
      return {
        type: 'tab',
        schema: currentSchema,
        dataContext: dataContext.serialize(),
        data: mapDataModelOrUndefined,
        dataFocusLog,
        schemaFocusLog,
        currentTabIndex: currentContentIndex,
        tabs: uiSchemaContext.contents().map((content) => ({
          label: content.currentSchema.dataSchema.label ?? '',
          dataContext: dataContext.pushMapKey(assertUISchemaKeyIsString(content.currentSchema.key)).serialize(),
        })),
        currentChild: buildUIModel(
          childContext,
          oldModel?.type === 'tab' && currentContentIndex === oldModel.currentTabIndex
            ? oldModel.currentChild
            : undefined,
          nextDataModelContext,
          childContext.currentSchema.keyFlatten ? dataPathFocus : dataPathFocus?.next(),
          dataFocusLog?.c[currentContentIndex],
          schemaFocusLog?.c[currentContentIndex],
        ),
      };
    }

    case 'form': {
      const dataModel = dataContext.currentModel;
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      return {
        type: 'form',
        schema: currentSchema,
        dataContext: dataContext.serialize(),
        data: mapDataModelOrUndefined,
        dataFocusLog,
        schemaFocusLog,
        // contentsにはDataModelを渡してコールバックの引数にdataPointerを渡せる様にすべきか？
        // => selfをDataPointerにすべきかと思って上記を書いたけど、そんなことはないか。
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const nextDataModelContext = getMapChildContextForFlattenable(contentContext, dataContext);
          return {
            model: buildUIModel(
              contentContext,
              oldModel?.type === 'form' ? oldModel.contents[index].model : undefined,
              nextDataModelContext,
              contentContext.currentSchema.keyFlatten ? dataPathFocus : dataPathFocus?.next(),
              dataFocusLog?.c[index],
              schemaFocusLog?.c[index],
            ),
            label: contentContext.currentSchema.dataSchema.label ?? '',
          };
        }),
      };
    }

    case 'table': {
      const dataModel = dataContext.currentModel;
      let mapOrListDataOrUndefined: MapDataModel | ListDataModel | undefined;
      const oldTableModel = oldModel?.type === 'table' ? oldModel : undefined;
      const oldRowsById = new Map(oldTableModel?.rows.map((row) => [getIdFromDataPointer(row.pointer), row]) ?? []);
      let rows: readonly TableUIModelRow[];
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        if (dataModelIsMap(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapMapDataModelWithPointer(dataModel, (rowData, pointer, key, index) => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = dataPathFocus?.next();

            const rowDataContext = dataContext.pushMapIndex(index, key);
            return {
              pointer,
              key,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    throw new Error(`Current schema must have key`);
                  }
                  return buildUIModel(
                    contentContext,
                    oldRow?.cells[index],
                    rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                    rowDataPathFocus?.next(),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }
              }),
            };
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
            const rowDataPathFocus = dataPathFocus?.next();
            const rowDataContext = dataContext.pushListIndex(index);
            return {
              pointer,
              key: undefined,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, index.toString());
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    throw new Error(`Current schema must have key`);
                  }
                  return buildUIModel(
                    contentContext,
                    oldRow?.cells[index],
                    rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                    rowDataPathFocus?.next(),
                    rowDataFocusLog?.c[index],
                    schemaFocusLog?.c[index],
                  );
                }
              }),
            };
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
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
      };
    }

    case 'mappingTable': {
      const dataModel = dataContext.currentModel;
      const mapOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const referenceData = getDataModelBySinglePath(currentSchema.sourcePath, dataContext.toWithoutSchema());
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- findMapDataIndexOfKeyで手に入れたindexなのでpointerは必ず取得できる
            const pointer = getMapDataPointerAtIndex(mapOrUndefined, rowMapDataIndex)!;
            const rowData = getMapDataAtPointer(mapOrUndefined, pointer);
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = dataPathFocus?.next();

            rows.push({
              pointer,
              key,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                    throw new Error('mapping tableの要素はkey指定を省略不可');
                  }
                  return buildUIModel(
                    contentContext,
                    undefined,
                    rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                    rowDataPathFocus?.next(),
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
            const rowDataPathFocus = dataPathFocus?.next();
            const rowDataContext = dataContext.pushMapIndex(index, key);

            danglingRows.push({
              pointer,
              key,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  return buildUIModelForParentKey(contentContext.currentSchema, dataContext, pointer, key);
                } else {
                  if (contentContext.currentSchema.key === undefined) {
                    // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                    throw new Error('mapping tableの要素はkey指定を省略不可');
                  }
                  return buildUIModel(
                    contentContext,
                    undefined,
                    rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                    rowDataPathFocus?.next(),
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
        dataFocusLog,
        schemaFocusLog,
        columns: uiSchemaContext.contents().map((content) => ({label: content.currentSchema.dataSchema.label ?? ''})),
        rows,
        danglingRows,
      };
    }

    case 'contentList': {
      const dataModel = dataContext.currentModel;
      const contentContext = uiSchemaContext.content();
      let indexes: ContentListIndex[];
      const modelBase = {
        type: 'contentList',
        dataContext: dataContext.serialize(),
        schema: currentSchema,
        dataFocusLog,
        schemaFocusLog,
      } as const satisfies Partial<ContentListUIModel>;
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        // TODO FixedMap対応だけではダメ
        const itemDataSchema =
          currentSchema.dataSchema.item?.t === DataSchemaType.FixedMap ? currentSchema.dataSchema.item : undefined;
        const mapDataModel = dataModelIsMap(dataModel) ? dataModel : undefined;
        if (mapDataModel && mapDataSize(mapDataModel) > 0) {
          indexes = mapMapDataModelWithPointer(mapDataModel, (item, pointer, key, index) => {
            const childContext = dataContext.pushMapIndex(index, key);
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, childContext.toWithoutSchema())
                : [key ?? undefined],
              pointer,
              dataContext: childContext.serialize(),
            };
          });

          let currentDataIndex =
            dataPathFocus?.mapChild(mapDataModel)?.[2] ??
            (dataFocusLog?.a && getMapDataIndexForPointer(mapDataModel, dataFocusLog.a)) ??
            0;
          const pointer = getMapDataPointerAtIndex(mapDataModel, currentDataIndex);
          const key = getMapKeyAtIndex(mapDataModel, currentDataIndex);
          if (pointer) {
            const content = buildUIModel(
              contentContext,
              oldModel?.type === 'contentList' && dataPointerIdEquals(pointer, oldModel.currentPointer)
                ? oldModel.content
                : undefined,
              dataContext.pushMapIndex(currentDataIndex, key),
              dataPathFocus?.next(),
              dataFocusLog?.c[getIdFromDataPointer(pointer)],
              schemaFocusLog,
            );
            return {
              ...modelBase,
              data: mapDataModel,
              indexes,
              currentIndex: currentDataIndex,
              currentPointer: pointer,
              content,
            };
          }
        } else {
          indexes = [];
        }
      } else {
        const listDataModel = dataModelIsList(dataModel) ? dataModel : undefined;
        if (dataModelIsList(listDataModel) && listDataSize(listDataModel) > 0) {
          // TODO FixedMap対応だけではダメ
          const itemDataSchema =
            currentSchema.dataSchema.item?.t === DataSchemaType.FixedMap ? currentSchema.dataSchema.item : undefined;

          indexes = mapListDataModelWithPointer(listDataModel, (item, pointer, index) => {
            const childContext = dataContext.pushListIndex(index);
            return {
              label: itemDataSchema?.dataLabel
                ? fillTemplateLine(itemDataSchema.dataLabel, childContext.toWithoutSchema())
                : [index.toString()],
              pointer,
              dataContext: childContext.serialize(),
            };
          });

          let currentDataIndex =
            dataPathFocus?.listChild(listDataModel)?.[1] ??
            (dataFocusLog?.a && getListDataIndexForPointer(listDataModel, dataFocusLog.a)) ??
            0;
          const pointer = getListDataPointerAt(listDataModel, currentDataIndex);
          if (pointer) {
            const content = buildUIModel(
              contentContext,
              oldModel?.type === 'contentList' && dataPointerIdEquals(pointer, oldModel.currentPointer)
                ? oldModel.content
                : undefined,
              dataContext.pushListIndex(currentDataIndex),
              dataPathFocus?.next(),
              dataFocusLog?.c?.[getIdFromDataPointer(pointer)],
              schemaFocusLog,
            );
            return {
              ...modelBase,
              data: listDataModel,
              indexes,
              currentIndex: currentDataIndex,
              currentPointer: pointer,
              content,
            };
          }
        } else {
          indexes = [];
        }
      }
      return {...modelBase, data: undefined, indexes};
    }

    case 'text': {
      const stringDataModel = dataModelIsString(dataContext.currentModel) ? dataContext.currentModel : undefined;
      const value = stringDataModel !== undefined ? stringDataModelToString(stringDataModel) : undefined;
      return {
        type: 'text',
        schema: currentSchema,
        data: stringDataModel,
        dataContext: dataContext.serialize(),
        dataFocusLog,
        schemaFocusLog,
        // TODO dataModelをプロパティとして持つなら、value不要っぽい
        value: value || '',
      };
    }

    case 'number': {
      const numberData = dataModelIsNumber(dataContext.currentModel) ? dataContext.currentModel : undefined;
      return {
        type: 'number',
        schema: currentSchema,
        data: numberData,
        dataContext: dataContext.serialize(),
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'checkbox': {
      return {
        type: 'checkbox',
        schema: currentSchema,
        data: dataModelIsBoolean(dataContext.currentModel) ? dataContext.currentModel : undefined,
        dataContext: dataContext.serialize(),
        dataFocusLog,
        schemaFocusLog,
      };
    }

    case 'select': {
      const modelBase = {
        type: 'select',
        schema: currentSchema,
        dataContext: dataContext.serialize(),
        dataFocusLog,
        schemaFocusLog,
      } as const satisfies Partial<SelectUIModel>;
      if (currentSchema.isMulti) {
        const listOrUndefined = dataModelIsList(dataContext.currentModel) ? dataContext.currentModel : undefined;
        return {
          ...modelBase,
          isMulti: true,
          data: listOrUndefined,
          currents: listOrUndefined
            ? mapListDataModelWithPointer(listOrUndefined, (item, pointer, index) => ({
                ...selectUIModelGetCurrent(currentSchema, item, dataContext),
                dataContext: dataContext.pushListIndex(index).serialize(),
              }))
            : [],
        };
      } else {
        return {
          ...modelBase,
          data: dataContext.currentModel,
          current: selectUIModelGetCurrent(currentSchema, dataContext.currentModel, dataContext),
        };
      }
    }

    case 'conditional': {
      const [childDataContext, conditionKey] = dataContext.pushConditionalOrSelfWithKey();
      return buildUIModel(
        uiSchemaContext.conditionalContentForKey(conditionKey),
        undefined,
        childDataContext,
        dataPathFocus,
        dataFocusLog,
        schemaFocusLog,
      );
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
