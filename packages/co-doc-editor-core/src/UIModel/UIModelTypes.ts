import {ForwardDataPath} from '../DataModel/DataPath';
import {DataPointer, NullDataModel, StringDataModel} from '../DataModel/DataModelTypes';
import {ContentListUISchema, FormUISchema, TabUISchema, TextUISchema} from './UISchemaTypes';
import {FilledTemplateNode} from '../DataModel/TemplateEngine';

export interface TabUIModel {
  readonly type: 'tab';
  readonly schema: TabUISchema;
  readonly dataPath: ForwardDataPath;
  readonly currentTabIndex: number;
  readonly tabs: readonly TabUIModelTab[];
  readonly currentChild: UIModel | undefined;
}

export interface TabUIModelTab {
  readonly label: string;
  readonly dataPath: ForwardDataPath;
}

export interface FormUIModel {
  readonly type: 'form';
  readonly schema: FormUISchema;
  readonly dataPath: ForwardDataPath;
  readonly contents: readonly FormUIModelContent[];
}

export interface FormUIModelContent {
  readonly label: string;
  readonly model: UIModel;
}

interface TextUIModelBase {
  readonly type: 'text';
}

interface KeyTextUIModel extends TextUIModelBase {
  readonly isKey: true;
  readonly parentDataPath: ForwardDataPath;
  readonly selfPointer: DataPointer;
  readonly value: string | null;
}

interface StandardTextUIModel extends TextUIModelBase {
  readonly isKey?: undefined;
  readonly schema: TextUISchema;
  readonly dataPath: ForwardDataPath;
  readonly value: StringDataModel | NullDataModel;
}

export type TextUIModel = KeyTextUIModel | StandardTextUIModel;

interface ContentListUIModelBase {
  readonly type: 'contentList';
  readonly schema: ContentListUISchema;
  readonly dataPath: ForwardDataPath;
  readonly indexes: readonly ContentListIndex[];
}

interface EmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex?: undefined;
  readonly content?: undefined;
}

interface NonEmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex: number;
  readonly content: UIModel;
}

export type ContentListUIModel = EmptyContentListUIModel | NonEmptyContentListUIModel;

export interface ContentListIndex {
  readonly label: readonly FilledTemplateNode[];
  readonly pointer: DataPointer;
  readonly dataPath: ForwardDataPath;
}

export type UIModel = TabUIModel | FormUIModel | TextUIModel | ContentListUIModel;
