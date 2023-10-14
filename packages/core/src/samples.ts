import {RootSchemaConfig} from './common/ConfigTypes';

export const simpleRecursiveSampleConfig: RootSchemaConfig = {
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
        dataLabel: '{{label}}',
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
};
