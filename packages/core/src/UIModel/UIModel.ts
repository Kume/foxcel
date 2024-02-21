import {ContentListIndex, ContentListUIModel, SelectUIModel, TableUIModelRow, UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {ListDataModel, MapDataModel} from '../DataModel/DataModelTypes';
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
  getListDataIndexAtPointer,
  getListDataPointerAt,
  getMapDataIndexForPointer,
  getMapDataPointerAtIndex,
  getMapItemAt,
  getMapKeyAtIndex,
  listDataSize,
  mapDataSize,
  mapListDataModelWithPointer,
  mapMapDataModelWithPointer,
  PathContainer,
  stringDataModelToString,
} from '../DataModel/DataModel';
import {dataSchemaIsMap, DataSchemaType} from '../DataModel/DataSchema';
import {assertUISchemaKeyIsString, stringUISchemaKeyToString, UISchemaKey, uiSchemaKeyIsParentKey} from './UISchema';
import {fillTemplateLine} from '../DataModel/TemplateEngine';
import {DataModelContext} from '../DataModel/DataModelContext';
import {selectUIModelGetCurrent} from './SelectUIModel';
import {getDataModelBySinglePath} from '../DataModel/DataModelCollector';

function getMapChildForFlattenable(
  map: MapDataModel | undefined,
  childContext: UISchemaContext,
  dataContext: DataModelContext,
  focus: PathContainer | undefined,
): [context: DataModelContext, focus: PathContainer | undefined] {
  if (uiSchemaKeyIsParentKey(childContext.currentSchema.key)) {
    return [dataContext.pushIsParentKey(), undefined]; // TODO keyに対してフォーカスがあたっていることを表現する方法を用意する
  } else {
    if (childContext.currentSchema.keyFlatten) {
      return [dataContext, focus];
    } else {
      if (childContext.currentSchema.key === undefined) {
        throw new Error(`Current schema must have key`);
      }
      return [
        dataContext.pushMapIndexOrKey(stringUISchemaKeyToString(childContext.currentSchema.key)),
        map !== undefined ? focus?.nextForMapKey(map, childContext.currentSchema.key) : undefined,
      ];
    }
  }
}

function nextFocusForMapKey(
  focus: PathContainer | undefined,
  map: MapDataModel | undefined,
  key: UISchemaKey,
): PathContainer | undefined {
  if (uiSchemaKeyIsParentKey(key) || map === undefined) {
    return undefined;
  }
  return focus?.nextForMapKey(map, key);
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
      const focusedKey = dataPathFocus?.mapChild(dataModel)?.[1];
      const currentContentIndex = uiSchemaContext.contentsIndexForKey(focusedKey) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const mapDataModelOrUndefined = dataModelIsMap(dataModel) ? dataModel : undefined;
      const [nextDataModelContext, nextFocus] = getMapChildForFlattenable(
        mapDataModelOrUndefined,
        childContext,
        dataContext,
        dataPathFocus,
      );
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
          nextFocus,
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
        contents: uiSchemaContext.contents().map((contentContext, index) => {
          const [nextDataModelContext, nextFocus] = getMapChildForFlattenable(
            mapDataModelOrUndefined,
            contentContext,
            dataContext,
            dataPathFocus,
          );
          return {
            model: buildUIModel(
              contentContext,
              oldModel?.type === 'form' ? oldModel.contents[index].model : undefined,
              nextDataModelContext,
              nextFocus,
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
      // TODO キャッシュ実装時にちゃんと実装する
      // const oldRowsById = new Map(oldTableModel?.rows.map((row) => [getIdFromDataPointer(row.pointer), row]) ?? []);
      const oldRowsById = new Map([]);
      let rows: readonly TableUIModelRow[];
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        if (dataModelIsMap(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapMapDataModelWithPointer(dataModel, (rowData, pointer, key, index): TableUIModelRow => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = key === null ? undefined : dataPathFocus?.nextForMapKey(dataModel, key);

            const rowDataContext = dataContext.pushMapIndex(index, key);
            return {
              key,
              uniqueKey: id,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (contentContext.currentSchema.key === undefined) {
                  throw new Error(`Current schema must have key`);
                }
                return buildUIModel(
                  contentContext,
                  // oldRow?.cells[index],
                  undefined,
                  uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? rowDataContext.pushIsParentKey()
                    : rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                  nextFocusForMapKey(rowDataPathFocus, rowMapDataOrUndefined, contentContext.currentSchema.key),
                  rowDataFocusLog?.c[index],
                  schemaFocusLog?.c[index],
                );
              }),
            };
          });
        } else {
          rows = [];
        }
      } else {
        if (dataModelIsList(dataModel)) {
          mapOrListDataOrUndefined = dataModel;
          rows = mapListDataModelWithPointer(dataModel, (rowData, pointer, index): TableUIModelRow => {
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const id = getIdFromDataPointer(pointer);
            const oldRow = oldRowsById.get(id);
            const rowDataFocusLog = dataFocusLog?.c[id];
            const rowDataPathFocus = dataPathFocus?.nextForListIndex(dataModel, index);
            const rowDataContext = dataContext.pushListIndex(index);
            return {
              key: undefined,
              uniqueKey: id,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (contentContext.currentSchema.key === undefined) {
                  throw new Error(`Current schema must have key`);
                }
                return buildUIModel(
                  contentContext,
                  // TODO キャッシュ実装時にちゃんと実装する
                  //oldRow?.cells[index],
                  undefined,
                  uiSchemaKeyIsParentKey(contentContext.currentSchema.key)
                    ? rowDataContext.pushIsParentKey()
                    : rowDataContext.pushMapIndexOrKey(stringUISchemaKeyToString(contentContext.currentSchema.key)),
                  nextFocusForMapKey(rowDataPathFocus, rowMapDataOrUndefined, contentContext.currentSchema.key),
                  rowDataFocusLog?.c[index],
                  schemaFocusLog?.c[index],
                );
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
      const rows: TableUIModelRow[] = [];
      const danglingRows: TableUIModelRow[] = [];
      if (dataModelIsMap(referenceData)) {
        const mappedKeys = new Set<string>();
        if (mapOrUndefined) {
          for (const [, , key] of eachMapDataItem(referenceData)) {
            if (key === null || mappedKeys.has(key)) {
              continue;
            }
            mappedKeys.add(key);

            const rowMapItem = getMapItemAt(mapOrUndefined, key);
            const rowData = rowMapItem?.[0];
            const pointer = rowMapItem?.[1];
            const rowDataContext = rowMapItem
              ? dataContext.pushMapIndex(rowMapItem[3], key)
              : dataContext.pushMapKey(key);
            const id = getIdFromDataPointer(pointer);
            const rowMapDataOrUndefined = dataModelIsMap(rowData) ? rowData : undefined;
            const rowDataFocusLog = id === undefined ? undefined : dataFocusLog?.c[id];
            const rowDataPathFocus = dataPathFocus?.nextForMapKey(mapOrUndefined, key);

            rows.push({
              key,
              uniqueKey: id ?? key,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (contentContext.currentSchema.key === undefined) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableの要素はkey指定を省略不可');
                } else if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableでkeyを編集することは不可');
                }
                return buildUIModel(
                  contentContext,
                  undefined,
                  rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                  nextFocusForMapKey(rowDataPathFocus, rowMapDataOrUndefined, contentContext.currentSchema.key),
                  rowDataFocusLog?.c[index],
                  schemaFocusLog?.c[index],
                );
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
            const rowDataPathFocus = dataPathFocus?.nextForMapKey(mapOrUndefined, key);
            const rowDataContext = dataContext.pushMapIndex(index, key);

            danglingRows.push({
              key,
              uniqueKey: id,
              dataContext: rowDataContext.serialize(),
              data: rowMapDataOrUndefined,
              dataFocusLog: rowDataFocusLog,
              cells: uiSchemaContext.contents().map((contentContext, index) => {
                if (contentContext.currentSchema.key === undefined) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableの要素はkey指定を省略不可');
                } else if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableでkeyを編集することは不可');
                }
                return buildUIModel(
                  contentContext,
                  undefined,
                  rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                  nextFocusForMapKey(rowDataPathFocus, rowMapDataOrUndefined, contentContext.currentSchema.key),
                  rowDataFocusLog?.c[index],
                  schemaFocusLog?.c[index],
                );
              }),
            });
          }
        } else {
          // 対応するデータは存在しないが、データモデル上仮想的に空の列データを持たせる必要がある。
          for (const [, , key, index] of eachMapDataItem(referenceData)) {
            if (key === null || mappedKeys.has(key)) {
              continue;
            }
            mappedKeys.add(key);
            const rowDataContext = dataContext.pushMapKey(key);
            const rowDataPathFocus = dataPathFocus?.nextForMapKey(undefined, key);
            rows.push({
              key,
              uniqueKey: key,
              dataContext: rowDataContext.serialize(),
              data: undefined,
              dataFocusLog: undefined,
              cells: uiSchemaContext.contents().map((contentContext) => {
                // TODO 共通化
                if (uiSchemaKeyIsParentKey(contentContext.currentSchema.key)) {
                  // TODO エラーハンドリング
                  throw new Error('mapping tableの中に$key指定の要素が含まれていてはならない。');
                } else if (contentContext.currentSchema.key === undefined) {
                  // TODO エラーハンドリング (schema生成時のバリデーションが十分であればこれは不要かも)
                  throw new Error('mapping tableの要素はkey指定を省略不可');
                }
                return buildUIModel(
                  contentContext,
                  undefined,
                  rowDataContext.pushMapIndexOrKey(contentContext.currentSchema.key),
                  nextFocusForMapKey(rowDataPathFocus, undefined, contentContext.currentSchema.key),
                  undefined,
                  schemaFocusLog?.c[index],
                );
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
        //      currentSchema.dataSchema.item は conditional or recursive の可能性があるのでそのままでも使えない
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

          const currentDataIndex =
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
              key === null ? undefined : dataPathFocus?.nextForMapKey(mapDataModel, key),
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
          //      currentSchema.dataSchema.item は conditional or recursive の可能性があるのでそのままでも使えない
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

          const currentDataIndex =
            dataPathFocus?.listChild(listDataModel)?.[1] ??
            (dataFocusLog?.a && getListDataIndexAtPointer(listDataModel, dataFocusLog.a)) ??
            0;
          const pointer = getListDataPointerAt(listDataModel, currentDataIndex);
          if (pointer) {
            const content = buildUIModel(
              contentContext,
              oldModel?.type === 'contentList' && dataPointerIdEquals(pointer, oldModel.currentPointer)
                ? oldModel.content
                : undefined,
              dataContext.pushListIndex(currentDataIndex),
              dataPathFocus?.nextForListIndex(listDataModel, currentDataIndex),
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
      if (uiSchemaKeyIsParentKey(currentSchema.key)) {
        return {
          type: 'text',
          isKey: true,
          schema: currentSchema,
          dataContext: dataContext.pushIsParentKey().serialize(),
          value: dataContext.parentKeyDataModel ?? null,
        };
      } else {
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
