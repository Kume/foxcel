import {DataSchemaConfig, RootSchemaConfig} from './ConfigTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {unknownToDataModel} from '../DataModel/DataModel';
import {buildSimpleDataSchema, DataSchemaExcludeRecursive} from '../DataModel/DataSchema';

export const configFixtures = {
  simpleRecursive: {
    schema: {
      dataSchema: {
        type: 'fixed_map',
        items: {
          root: 'recursiveItem',
        },
      },
      namedDataSchema: {
        recursiveItem: {
          type: 'list',
          label: 'Children',
          item: {
            type: 'fixed_map',
            items: {
              label: {
                type: 'string',
                label: 'Name',
              },
              children: 'recursiveItem',
            },
          },
        },
      },
      namedUiSchema: {
        recursiveUi: {
          key: 'root',
          type: 'contentList',
          content: {
            type: 'form',
            contents: [
              {type: 'text', key: 'label'},
              {type: 'ref', ref: 'recursiveUi', key: 'children'},
            ],
          },
        },
      },
      uiRoot: {
        type: 'tab',
        contents: [{type: 'ref', ref: 'recursiveUi', key: 'root'}],
      },
      fileMap: {children: []},
    },
    data: unknownToDataModel({
      root: [
        {
          children: [{children: []}],
        },
        {
          children: [],
        },
      ],
    }),
  },
} as const satisfies Readonly<Record<string, {readonly schema: RootSchemaConfig; readonly data?: DataModel}>>;

export const dataSchemaFixture = {
  mapMapMap: {type: 'map', item: {type: 'map', item: {type: 'map', item: {type: 'fixed_map', items: {}}}}},
  mapListMap: {type: 'map', item: {type: 'list', item: {type: 'map', item: {type: 'fixed_map', items: {}}}}},
} as const satisfies Readonly<Record<string, DataSchemaConfig>>;

export function dataSchemaForFixture(config: DataSchemaConfig): DataSchemaExcludeRecursive {
  return buildSimpleDataSchema({
    dataSchema: config,
    fileMap: {children: []},
    // @ts-expect-error 今のところ内部でuiSchemaは使われてないので何でも良い だめになったらユニットテストが落ちるのでそこで検知予定
    uiSchema: {},
  });
}
