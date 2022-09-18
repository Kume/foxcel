import {UISchemaExcludeRecursive} from './UIModel/UISchema';
import {DataMapperConfig} from './common/ConfigTypes';
import {RemoteDataStorageSaveItem} from './Storage/WriteOnlyRemoteDataStorage';

export interface InitialLoadMessage {
  readonly type: 'initialLoad';
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly data: unknown;
  readonly dataMapperConfig: DataMapperConfig | undefined;
}

export type BackToFrontMessage = InitialLoadMessage;

export interface SaveFileMessage {
  readonly type: 'saveFile';
  readonly items: readonly RemoteDataStorageSaveItem[];
  readonly deletePaths: readonly (readonly string[])[];
}

export type FrontToBackMessage = SaveFileMessage;
