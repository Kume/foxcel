import {UIModel} from './UIModelTypes';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModel} from '../DataModel/DataModelTypes';
import {dataPathFirstComponentOrUndefined, ForwardDataPath, pushDataPath, shiftDataPath} from '../DataModel/DataPath';
import {UISchemaContext} from './UISchemaContext';
import {dataModelIsString, stringDataModelToString} from '../DataModel/DataModel';

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
      console.log('xxxx form', uiSchemaContext.contents());
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
  }
}
