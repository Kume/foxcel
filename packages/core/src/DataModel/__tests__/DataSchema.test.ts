import {buildDataSchema, DataSchemaType} from '../DataSchema';
import {ObjectDataStorage} from '../../Storage/ObjectDataStorage';
import {RootSchemaConfig} from '../../common/ConfigTypes';
import {YamlDataFormatter} from '../../Storage/YamlDataFormatter';

describe('Unit tests for buildDataSchema', () => {
  it('Build recursive data schema', async () => {
    const storage = new ObjectDataStorage();
    const config: RootSchemaConfig = {
      dataSchema: {
        type: 'fixed_map',
        items: {
          root: 'recursiveItem',
        },
      },
      namedDataSchema: {
        recursiveItem: {
          type: 'list',
          item: {
            type: 'fixed_map',
            items: {
              children: 'recursiveItem',
            },
          },
        },
      },
      uiRoot: {type: 'text'},
      fileMap: {children: []},
    };
    const schema = await buildDataSchema(config, storage, new YamlDataFormatter());
    expect(schema).toMatchObject({
      t: DataSchemaType.FixedMap,
      items: {
        root: {
          t: DataSchemaType.List,
          item: {
            t: DataSchemaType.FixedMap,
            items: {
              children: {t: DataSchemaType.Recursive, depth: 2},
            },
          },
        },
      },
    });
  });
});
