import {RootSchemaConfig} from './ConfigTypes';
import {DataModel} from '../DataModel/DataModelTypes';
import {unknownToDataModel} from '../DataModel/DataModel';

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
