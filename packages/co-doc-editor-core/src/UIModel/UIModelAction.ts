import {UIModel} from './UIModelTypes';
import {ForwardDataPath} from '../DataModel/DataPath';
import {DataModel} from '../DataModel/DataModelTypes';

export interface ChangeDataUIModelAction {
  readonly type: 'data';
  readonly dataPath: ForwardDataPath;
  readonly data: DataModel;
}

export type UIModelAction = ChangeDataUIModelAction;

export function execUIModelAction(model: UIModel): UIModel {}
