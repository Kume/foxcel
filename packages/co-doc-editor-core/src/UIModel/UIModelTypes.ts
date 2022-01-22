import {ForwardDataPath} from '../DataModel/DataPath';
import {
  DataModel,
  DataPointer,
  ListDataModel,
  MapDataModel,
  NullDataModel,
  StringDataModel,
} from '../DataModel/DataModelTypes';
import {
  ContentListUISchema,
  FormUISchema,
  SelectUISchema,
  TableUISchema,
  TabUISchema,
  TextUISchema,
} from './UISchemaTypes';
import {FilledTemplateNode} from '../DataModel/TemplateEngine';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {DataModelContext} from '../DataModel/DataModelContext';

interface UIModelCommon {
  readonly dataPath: ForwardDataPath;
  readonly dataContext: DataModelContext;
  readonly dataPathFocus: ForwardDataPath | undefined;
  readonly dataFocusLog: UIDataFocusLogNode | undefined;
  readonly schemaFocusLog: UISchemaFocusLogNode | undefined;
}

export interface TabUIModel extends UIModelCommon {
  readonly type: 'tab';
  readonly isKey?: void;
  readonly schema: TabUISchema;
  readonly data: MapDataModel | undefined;
  readonly currentTabIndex: number;
  readonly tabs: readonly TabUIModelTab[];
  readonly currentChild: UIModel | undefined;
}

export interface TabUIModelTab {
  readonly label: string;
  readonly dataPath: ForwardDataPath;
}

export interface FormUIModel extends UIModelCommon {
  readonly type: 'form';
  readonly isKey?: void;
  readonly schema: FormUISchema;
  readonly data: MapDataModel | undefined;
  readonly contents: readonly FormUIModelContent[];
}

export interface FormUIModelContent {
  readonly label: string;
  readonly model: UIModel;
}

interface KeyTextUIModel {
  readonly type: 'text';
  readonly isKey: true;
  readonly schema?: undefined;
  readonly parentDataPath: ForwardDataPath;
  readonly selfPointer: DataPointer;
  readonly value: string | null;
}

interface StandardTextUIModel extends UIModelCommon {
  readonly type: 'text';
  readonly isKey?: void;
  readonly schema: TextUISchema;
  readonly data: StringDataModel | undefined;
  readonly dataPath: ForwardDataPath;
  readonly value: StringDataModel | NullDataModel;
}

export type TextUIModel = KeyTextUIModel | StandardTextUIModel;

interface ContentListUIModelBase extends UIModelCommon {
  readonly type: 'contentList';
  readonly isKey?: void;
  readonly schema: ContentListUISchema;
  readonly data: MapDataModel | ListDataModel | undefined;
  readonly indexes: readonly ContentListIndex[];
}

interface EmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex?: undefined;
  readonly currentPointer?: undefined;
  readonly content?: undefined;
}

interface NonEmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex: number;
  readonly currentPointer: DataPointer;
  readonly content: UIModel;
}

export type ContentListUIModel = EmptyContentListUIModel | NonEmptyContentListUIModel;

export interface ContentListIndex {
  readonly label: readonly FilledTemplateNode[];
  readonly pointer: DataPointer;
  readonly dataPath: ForwardDataPath;
}

export interface TableUIModel extends UIModelCommon {
  readonly type: 'table';
  readonly isKey?: void;
  readonly schema: TableUISchema;
  readonly data: MapDataModel | ListDataModel | undefined;
  readonly columns: readonly TableUIModelColumn[];
  readonly rows: readonly TableUIModelRow[];
}

export interface TableUIModelColumn {
  readonly label: string;
}

export interface TableUIModelRow {
  readonly pointer: DataPointer;
  readonly data: MapDataModel | undefined;
  readonly dataPath: ForwardDataPath;
  readonly dataPathFocus: ForwardDataPath | undefined;
  readonly dataFocusLog: UIDataFocusLogNode | undefined;
  readonly cells: readonly UIModel[];
}

export interface SelectUIModel extends UIModelCommon {
  readonly type: 'select';
  readonly isKey?: void;
  readonly schema: SelectUISchema;
  readonly data: DataModel | undefined;
  readonly current?: {
    readonly label: string;
    readonly value: string;
  };
}

export type UIModel = TabUIModel | FormUIModel | TextUIModel | ContentListUIModel | TableUIModel | SelectUIModel;
