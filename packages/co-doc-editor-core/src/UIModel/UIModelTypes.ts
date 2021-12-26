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

export type UIModel = TabUIModel | FormUIModel | TextUIModel;
