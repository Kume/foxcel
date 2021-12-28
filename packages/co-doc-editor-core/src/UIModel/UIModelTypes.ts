import {ForwardDataPath} from '../DataModel/DataPath';

export interface TabUIModel {
  readonly type: 'tab';
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
  readonly dataPath: ForwardDataPath;
  readonly contents: readonly FormUIModelContent[];
}

export interface FormUIModelContent {
  readonly label: string;
  readonly model: UIModel;
}

export interface TextUIModel {
  readonly type: 'text';
  readonly dataPath: ForwardDataPath;
  readonly value: string;
}

interface ContentListUIModelBase {
  readonly type: 'contentList';
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
  readonly label: string;
}

export type UIModel = TabUIModel | FormUIModel | TextUIModel | ContentListUIModel;
