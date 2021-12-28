import {ContentListIndex, UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  dataPathFirstComponentOrUndefined,
  dataPathLastComponent,
  ForwardDataPath,
  pushDataPath,
  safeShiftDataPath,
  shiftDataPath,
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
  listDataSize,
  mapDataSize,
  mapListDataModel,
  mapMapDataModel,
  stringDataModelToString,
} from '../DataModel/DataModel';
import {dataSchemaIsMap} from '../DataModel/DataSchema';

export function buildUIModel(
  uiSchemaContext: UISchemaContext,
  dataModel: DataModel | undefined,
  dataPath: ForwardDataPath,
  dataPathFocus: ForwardDataPath | undefined,
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
): UIModel {
  const {currentSchema} = uiSchemaContext;
  switch (currentSchema.type) {
    case 'tab': {
      const firstPathComponent = dataPathFirstComponentOrUndefined(dataPathFocus);
      const currentContentIndex =
        uiSchemaContext.contentIndexForDataPathComponent(firstPathComponent, dataModel) ?? schemaFocusLog?.a ?? 0;
      const childContext = uiSchemaContext.digForIndex(currentContentIndex);
      const {model, pathComponent} = childContext.getDataFromParentData(dataModel, dataPath);
      return {
        type: 'tab',
        dataPath,
        currentTabIndex: currentContentIndex,
        tabs: uiSchemaContext.contents().map((content) => ({
          label: content.currentSchema.dataSchema.label ?? '',
          dataPath: pushDataPath(dataPath, content.currentSchema.key),
        })),
        // TODO dataFocus
        currentChild: buildUIModel(
          childContext,
          model,
          pathComponent ? pushDataPath(dataPath, pathComponent) : dataPath,
          dataPathFocus && shiftDataPath(dataPathFocus), // TODO keyFlattenの考慮
          undefined,
          schemaFocusLog?.c[currentContentIndex],
        ),
      };
    }

    case 'text': {
      const value = dataModel !== undefined && dataModelIsString(dataModel) && stringDataModelToString(dataModel);
      return {type: 'text', dataPath, value: value || ''};
    }

    case 'form': {
      return {
        type: 'form',
        dataPath,
        contents: uiSchemaContext.contents().map((content, index) => {
          const childDataModel = content.getDataFromParentData(dataModel, dataPath);
          return {
            model: buildUIModel(
              content,
              childDataModel.model,
              childDataModel.pathComponent ? pushDataPath(dataPath, childDataModel.pathComponent) : dataPath,
              dataPathFocus && shiftDataPath(dataPathFocus), // TODO keyFlattenの考慮
              // TODO フォーカス
              undefined,
              schemaFocusLog?.c[index],
            ),
            label: content.currentSchema.dataSchema.label ?? '',
          };
        }),
      };
    }

    case 'contentList': {
      const contentContext = uiSchemaContext.content();
      let indexes: ContentListIndex[];
      const focusPathComponent = dataPathFocus && dataPathLastComponent(dataPathFocus);
      const modelBase = {type: 'contentList', dataPath} as const;
      if (dataSchemaIsMap(currentSchema.dataSchema)) {
        const mapDataModel = dataModelIsMap(dataModel) ? dataModel : undefined;
        if (mapDataModel) {
          indexes = mapMapDataModel(mapDataModel, (item, key) => ({
            label: key ?? '---', // TODO スキーマ定義から表示するラベルを決定
          }));

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
            if (pointer) {
              const contentData = getMapDataAtIndex(mapDataModel, currentIndex);
              const content = buildUIModel(
                contentContext,
                contentData,
                pushDataPath(dataPath, toPointerPathComponent(pointer)),
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
          indexes = mapListDataModel(listDataModel, (item, key) => ({
            label: key.toString() ?? '---', // TODO スキーマ定義から表示するラベルを決定
          }));

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
                pushDataPath(dataPath, toPointerPathComponent(pointer)),
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
      }
      return {...modelBase, indexes};
    }
  }
}
