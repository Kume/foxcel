import {RootSchemaConfig} from '@foxcel/core';
import {buildDataSchema} from '@foxcel/core/dist/DataModel/DataSchema';
import {buildUISchema} from '@foxcel/core/dist/UIModel/UISchema';
import DataMapper from '@foxcel/core/dist/Storage/DataMapper';
import * as vscode from 'vscode';
import {dirUri, fileNameOfUri, VSCodeStorage} from './VSCodeStorage';
import YamlDataFormatter from '@foxcel/core/dist/Storage/YamlDataFormatter';
import {RawStorageDataTrait} from '@foxcel/core/dist/Storage/StorageDataTrait';
import {InitialLoadMessage} from '@foxcel/core/dist/messages';

export async function loadFile(schemaFileUri: vscode.Uri): Promise<InitialLoadMessage> {
  const storage = new VSCodeStorage(dirUri(schemaFileUri));
  const formatter = new YamlDataFormatter();
  // TODO スキーマファイルより上の階層をrootとすべきか検討
  const rootSchemaContent = await storage.loadAsync([fileNameOfUri(schemaFileUri)]);
  const rootSchema = formatter.parse(rootSchemaContent) as RootSchemaConfig; // TODO バリデーション
  const rootDataSchema = await buildDataSchema(rootSchema, storage, formatter);
  const rootUiSchema = await buildUISchema(rootSchema, rootDataSchema, storage, formatter);
  const mapper = DataMapper.build(rootSchema.fileMap);
  const loaded = await mapper.loadAsync(storage, RawStorageDataTrait);
  return {type: 'initialLoad', uiSchema: rootUiSchema, data: loaded?.model, dataMapperConfig: rootSchema.fileMap};
}
