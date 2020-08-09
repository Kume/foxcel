import DataStorage from './Storage/DataStorage';
import {DataFormatter} from './Storage/DataFormatter';
import {RootSchemaConfig} from './common/ConfigTypes';
import {buildDataSchema} from './DataModel/DataSchema';
import {buildUISchema, UISchema} from './UIModel/UISchema';

export async function loadFile(
  storage: DataStorage,
  rootSchemaPath: string[],
  formatter: DataFormatter,
): Promise<UISchema> {
  const rootSchemaContent = await storage.loadAsync(rootSchemaPath);
  const rootSchema = formatter.parse(rootSchemaContent) as RootSchemaConfig; // TODO バリデーション
  const rootDataSchema = await buildDataSchema(rootSchema, storage, formatter);
  console.log(rootDataSchema);
  const rootUiSchema = await buildUISchema(rootSchema, rootDataSchema, storage, formatter);
  return rootUiSchema;
}
