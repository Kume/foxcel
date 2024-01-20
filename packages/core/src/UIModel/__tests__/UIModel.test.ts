import ObjectDataStorage from '../../Storage/ObjectDataStorage';
import {buildDataSchema} from '../../DataModel/DataSchema';
import YamlDataFormatter from '../../Storage/YamlDataFormatter';
import {buildUISchema} from '../UISchema';
import {buildUIModel} from '../UIModel';
import {UISchemaContext} from '../UISchemaContext';
import {configFixtures} from '../../common/testFixtures';
import {DataModelContext} from '../../DataModel/DataModelContext';

describe('Unit tests for buildUIModel', () => {
  it('Can build simple recursive ui.', async () => {
    const storage = new ObjectDataStorage();
    const fixture = configFixtures.simpleRecursive;
    const dataSchema = await buildDataSchema(fixture.schema, storage, new YamlDataFormatter());
    const uiSchema = await buildUISchema(fixture.schema, dataSchema, storage, new YamlDataFormatter());

    const root = {model: fixture.data, schema: dataSchema};
    const uiModel = buildUIModel(
      UISchemaContext.createRootContext(uiSchema),
      undefined,
      DataModelContext.createRoot(root, false),
      undefined,
      undefined,
      undefined,
    );
    // TODO expectを書く
    console.log(uiModel);
  });
});
