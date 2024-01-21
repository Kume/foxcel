import {
  buildDataSchema,
  buildUISchema,
  DataMapper,
  InitialLoadMessage,
  RawStorageDataTrait,
  RootSchemaConfig,
  YamlDataFormatter,
} from '@foxcel/core';
import * as vscode from 'vscode';
import {dirUri, fileNameOfUri, VSCodeStorage} from './VSCodeStorage';

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
