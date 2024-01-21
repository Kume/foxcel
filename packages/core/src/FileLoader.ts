import {DataStorage} from './Storage/DataStorage';
import {DataFormatter} from './Storage/DataFormatter';
import {RootSchemaConfig} from './common/ConfigTypes';
import {buildDataSchema, DataSchemaExcludeRecursive} from './DataModel/DataSchema';
import {buildUISchema, UISchemaExcludeRecursive} from './UIModel/UISchema';
import {DataModel} from './DataModel/DataModelTypes';
import {DataMapper} from './Storage/DataMapper';
import {dataModelStorageDataTrait} from './DataModel/DataModelStorageDataTrait';

export async function loadFile(
  storage: DataStorage,
  rootSchemaPath: string[],
  formatter: DataFormatter,
): Promise<{uiSchema: UISchemaExcludeRecursive; dataSchema: DataSchemaExcludeRecursive; data: DataModel | undefined}> {
  const rootSchemaContent = await storage.loadAsync(rootSchemaPath);
  const rootSchema = formatter.parse(rootSchemaContent) as RootSchemaConfig; // TODO バリデーション
  const rootDataSchema = await buildDataSchema(rootSchema, storage, formatter);
  const rootUiSchema = await buildUISchema(rootSchema, rootDataSchema, storage, formatter);
  const mapper = DataMapper.build(rootSchema.fileMap);
  const loaded = await mapper.loadAsync(storage, dataModelStorageDataTrait);
  // console.log('xxxx loaded', {rootUiSchema, rootDataSchema, rootSchemaPath, rootSchemaContent, data: loaded?.model});
  return {uiSchema: rootUiSchema, dataSchema: rootDataSchema, data: loaded?.model};
}
