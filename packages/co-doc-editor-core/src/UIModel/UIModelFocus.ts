import {
  DataCollectionItem,
  DataModel,
  dataModelIsMap,
  dataPathFirstComponent,
  DataPointer,
  dataPointerForDataPath,
  ForwardDataPath,
  getFromDataModelForPathComponent,
  getMapDataAtPointer,
  MultiDataPath,
  pushDataPath,
  shiftDataPath,
} from '..';
import {UISchemaContext} from './UISchemaContext';
import {UIModel} from './UIModelTypes';
import {Writable} from '../common/utilTypes';

export interface ContentListUIFocusNode {
  readonly type: 'contentList';
  readonly isPrimary: boolean | undefined;
  readonly active: DataPointer | undefined;
  readonly child: UIFocusNode | undefined;
}

export interface FormUIFocusNode {
  readonly type: 'form';
  readonly isPrimary: boolean | undefined;
  readonly active?: number;
  readonly children: {[id: number]: UIFocusNode};
}

export interface TabUIFocusNode {
  readonly type: 'tab';
  readonly isPrimary: boolean | undefined;
  readonly active: number;
  readonly child: UIFocusNode | undefined;
}

export interface TableUIFocusNode {
  readonly type: 'table';
  readonly isPrimary: boolean | undefined;
  readonly activeRow: DataPointer;
  readonly activeColumn?: number;
}

export type UIFocusNode = ContentListUIFocusNode | FormUIFocusNode | TabUIFocusNode | TableUIFocusNode;

export interface UIDataFocusLogNode {
  /**
   * active
   */
  readonly a?: DataPointer;

  /**
   * children by id
   */
  readonly c: {readonly [id: number]: UIDataFocusLogNode};

  // /**
  //  * children by schema index
  //  */
  // readonly s: {readonly [id: number]: UIDataFocusLogNode};
}

export interface UISchemaFocusLogNode {
  /**
   * active schema index
   */
  readonly a?: number;

  /**
   * children by index
   */
  readonly c: {readonly [index: number]: UISchemaFocusLogNode};
}

export function logFocus(
  model: UIModel,
  dataModel: DataModel | undefined,
  dataPath: ForwardDataPath,
  uiSchemaContext: UISchemaContext,
  lastDataFocusLog: UIDataFocusLogNode | undefined,
  lastSchemaFocusLog: UISchemaFocusLogNode | undefined,
): {readonly dataFocus: UIDataFocusLogNode; readonly schemaFocus: UISchemaFocusLogNode} {
  const {currentSchema} = uiSchemaContext;
  const dataFocus: Writable<UIDataFocusLogNode> = {c: {...lastDataFocusLog?.c}};
  const schemaFocus: Writable<UISchemaFocusLogNode> = {c: {...lastSchemaFocusLog?.c}};
  switch (currentSchema.type) {
    case 'tab': {
      if (model.type !== 'tab') {
        throw new Error('ui model is not match to schema');
      }
      if (!model.currentChild) {
        dataFocus.a = lastDataFocusLog?.a;
        schemaFocus.a = lastSchemaFocusLog?.a;
        break;
      }
      schemaFocus.a = model.currentTabIndex;
      const childContext = uiSchemaContext.digForIndex(model.currentTabIndex);
      const {model: childDataModel, pathComponent: childPathComponent} = childContext.getDataFromParentData(
        dataModel,
        dataPath,
      );

      const childFocus = logFocus(
        model.currentChild,
        childDataModel,
        childPathComponent ? pushDataPath(dataPath, childPathComponent) : dataPath,
        childContext,
        undefined, // TODO
        lastSchemaFocusLog?.c[model.currentTabIndex],
      );
      schemaFocus.c[model.currentTabIndex] = childFocus.schemaFocus;
    }
  }
  return {dataFocus, schemaFocus};
}

export function focusUIModel(
  targetPath: ForwardDataPath | undefined,
  dataModel: DataModel | undefined,
  uiSchemaContext: UISchemaContext,
  collectDataForPath: undefined | ((path: MultiDataPath) => DataCollectionItem[]),
  dataFocusLog: UIDataFocusLogNode | undefined,
  schemaFocusLog: UISchemaFocusLogNode | undefined,
  // currentPath: ForwardDataPath = emptyDataPath,
): UIFocusNode | undefined {
  const firstPathComponent = targetPath && dataPathFirstComponent(targetPath);
  const {currentSchema} = uiSchemaContext;
  let isPrimary = true;
  switch (currentSchema.type) {
    case 'text':
    case 'checkbox':
    case 'number':
    case 'select': {
      return undefined;
    }
    case 'tab': {
      let activeIndex = uiSchemaIndexForDataPath(currentSchema.contents, uiSchemaContext, firstPathComponent);
      if (activeIndex === undefined) {
        // dataPathで直接フォーカスされない場合にはログを元にフォーカスをする。それも無いなら最初の要素にフォーカスする
        activeIndex = schemaFocusLog?.a ?? 0;
      } else {
        isPrimary = false;
        targetPath = undefined;
      }
      const childSchema = currentSchema.contents[activeIndex];
      if (!childSchema) {
        // 対処の子が存在しない = 子要素が0か指定された対象が存在しないならフォーカス不可
        return undefined;
      }

      const activeChildModel =
        firstPathComponent === undefined ? undefined : getFromDataModelForPathComponent(dataModel, firstPathComponent);
      const child = focusUIModel(
        targetPath && shiftDataPath(targetPath),
        activeChildModel,
        uiSchemaContext, // TODO push
        collectDataForPath,
        dataFocusLog?.s[activeIndex],
        schemaFocusLog?.c[activeIndex],
      );

      return {type: 'tab', isPrimary, active: activeIndex, child};
    }

    case 'form': {
      const activeIndex = uiSchemaIndexForDataPath(currentSchema.contents, uiSchemaContext, firstPathComponent);
      // formにおいては、データを元にしたフォーカスが存在しないならログを元にactiveを決める必要はない

      const children: {[id: number]: UIFocusNode} = {};
      currentSchema.contents.forEach((content, index) => {
        // contentに対応したdataModelを取得
        const childFocus = focusUIModel(
          undefined, // TODO 何かしらがマッチした子にのみtargetPathをshiftして渡す
          undefined, // TODO contentに対応したdataModelを取得
          uiSchemaContext, // TODO push
          collectDataForPath,
          dataFocusLog?.s[index],
          schemaFocusLog?.c[index],
        );
        if (childFocus) {
          children[index] = childFocus;
        }
      });

      return {type: 'form', isPrimary: activeIndex !== undefined, active: activeIndex, children};
    }

    case 'contentList': {
      let active = dataPointerForDataPath(dataModel, firstPathComponent);
      if (active === undefined) {
        active = dataFocusLog?.a;
      } else {
        isPrimary = false;
        targetPath = undefined;
      }

      const childModel = dataModelIsMap(dataModel) && active ? getMapDataAtPointer(dataModel, active) : undefined;

      const child = focusUIModel(
        targetPath && shiftDataPath(targetPath),
        childModel,
        uiSchemaContext, // TODO push
        collectDataForPath,
        active && dataFocusLog?.c[active.d],
        schemaFocusLog,
      );

      return {type: 'contentList', isPrimary, active, child};
    }

    case 'table':
      return undefined; // TODO

    case 'conditional':
      return undefined; // TODO

    case 'mappingTable':
      return undefined; // TODO
  }
}
