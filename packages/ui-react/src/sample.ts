import {RootSchemaConfig} from '@foxcel/core';

export const sampleConfig: RootSchemaConfig = {
  namedDataSchema: {
    testA13_type: {
      type: 'string',
      in: [
        {
          label: 'Type A',
          value: 'a',
        },
        {
          label: 'Type B',
          value: 'b',
        },
        {
          label: 'Type C',
          value: 'c',
        },
      ],
    },
  },
  dataSchema: {
    type: 'fixed_map',
    items: {
      testA: {
        type: 'map',
        label: 'テストA一覧',
        item: {
          type: 'fixed_map',
          dataLabel: '{{testA1}}',
          label: 'テストA',
          items: {
            testA1: {type: 'string', label: 'てすとA1'},
            testA2: {
              type: 'string',
              label: 'テストA2は長めのラベル名',
              in: ['testA2_one', {label: 'testA2_two', value: 'A2-2'}, {path: '../testA5/*/$key'}],
            },
            testA3: {
              type: 'fixed_map',
              label: 'テストA3',
              items: {
                testA3a: {
                  type: 'fixed_map',
                  label: 'テストA3a',
                  items: {
                    testA3a1: {type: 'string', label: 'テストA3a1'},
                    testA3a2: {type: 'string', label: 'テストA3a2'},
                  },
                },
                testA3b: {
                  type: 'fixed_map',
                  label: 'テストA3b',
                  items: {
                    testA3b1: {type: 'string', label: 'テストA3b1'},
                    testA3b2: {type: 'string', label: 'テストA3b2'},
                    testA3b3: {
                      type: 'map',
                      label: 'テストA3b3リスト',
                      item: {
                        type: 'fixed_map',
                        label: 'テストA3b3',
                        items: {
                          testA3b3a: {type: 'string', label: 'テストA3b3a'},
                          testA3b3b: {type: 'string', label: 'テストA3b3b'},
                        },
                      },
                    },
                  },
                },
              },
            },
            testA4: {
              type: 'fixed_map',
              label: 'テストA4',
              items: {
                testA4a: {
                  type: 'fixed_map',
                  label: 'テストA4a',
                  items: {
                    testA4a1: {type: 'string', label: 'テストA4a1'},
                    testA4a2: {type: 'string', label: 'テストA4a2'},
                  },
                },
                testA4b: {
                  type: 'fixed_map',
                  label: 'テストA4b',
                  items: {
                    testA4b1: {type: 'string', label: 'テストA4b1'},
                    testA4b2: {type: 'string', label: 'テストA4b2'},
                  },
                },
              },
            },
            testA5: {
              type: 'map',
              label: 'テストA5一覧',
              item: {
                type: 'fixed_map',
                label: 'テストA5',
                dataLabel: '{{testA5a}}',
                items: {
                  testA5a: {type: 'string', label: 'テストA5a'},
                  testA5b: {type: 'string', label: 'テストA5b'},
                  testA5c: {type: 'string', label: 'テストA5c', in: ['AAAA', 'BBBB']},
                  testA5d: {type: 'boolean', label: 'テストA5d'},
                  testA5e: {type: 'number', label: 'テストA5e'},
                  testA5f: {
                    type: 'list',
                    label: '複数選択',
                    item: {
                      type: 'string',
                      in: ['testA5f_one', {label: 'testA5f_two', value: 'A5f-2'}, {path: '../testA5/*/$key'}],
                    },
                  },
                },
              },
            },
            testA6: {
              type: 'boolean',
              label: 'テストA6許可',
            },
            testA7: {
              type: 'number',
              label: 'テストA7数値',
            },
            testA8: {
              type: 'map',
              label: 'テストA8マッピング',
              item: {
                type: 'fixed_map',
                label: 'テストA8',
                items: {
                  testA8a: {type: 'string', label: 'テストA8a'},
                  testA8b: {type: 'number', label: 'テストA8b'},
                  testA8c: {
                    type: 'string',
                    label: 'テストA5c',
                    in: [
                      {label: 'テストA5c-1', value: 'A5c-1'},
                      {label: 'テストA5c-2', value: 'A5c-2'},
                      {label: 'テストA5c-3', value: 'A5c-3'},
                    ],
                  },
                  testA8d: {type: 'boolean', label: 'テストA8d'},
                },
              },
            },
            testA9: {
              type: 'list',
              label: '複数選択',
              item: {
                type: 'string',
                in: ['testA9_one', {label: 'testA9_two', value: 'A9-2'}, {path: '../testA5/*/$key'}],
              },
            },
            testA10: {
              type: 'map',
              label: 'テストA10一覧',
              item: {
                type: 'fixed_map',
                label: 'テストA10',
                dataLabel: '{{testA10a}}',
                items: {
                  testA10a: {type: 'string', label: 'テストA10a'},
                  testA10b: {
                    type: 'string',
                    label: 'テストA10b',
                    in: [{path: '../../../testA5/*/$key'}],
                  },
                },
              },
            },
            testA11: {
              type: 'string',
              label: 'テストA11複数行テキスト',
            },
            testA12: {
              type: 'fixed_map',
              label: 'テストA12_deep',
              items: {
                testA12a: {
                  type: 'map',
                  label: 'テストA12aタブ',
                  item: {
                    type: 'fixed_map',
                    items: {
                      testA12a1: {
                        type: 'string',
                        label: 'testA12a1',
                      },
                      testA12a2: {
                        type: 'string',
                        label: 'testA12a2',
                      },
                    },
                  },
                },
                testA12b: {
                  type: 'map',
                  label: 'テストA12bタブ',
                  item: {
                    type: 'fixed_map',
                    items: {},
                  },
                },
              },
            },
            testA13: {
              type: 'conditional',
              items: {
                testA13a: {
                  condition: {path: 'type', match: 'a'},
                  item: {
                    type: 'fixed_map',
                    items: {
                      type: 'testA13_type',
                      label: {
                        type: 'string',
                        label: 'Name',
                      },
                      numberValue: {
                        type: 'number',
                        label: '数値',
                      },
                    },
                  },
                },
                testA13b: {
                  condition: {path: 'type', match: 'b'},
                  item: {
                    type: 'fixed_map',
                    items: {
                      type: 'testA13_type',
                      label: {
                        type: 'string',
                        label: 'Name',
                      },
                      booleanValue: {
                        type: 'boolean',
                        label: 'チェック',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      testB: {
        type: 'fixed_map',
        label: 'テストB',
        items: {
          testB1: {type: 'string', label: 'てすとB1'},
          testB2: {type: 'string', label: 'テストB2'},
        },
      },
    },
  },
  fileMap: {
    children: [],
  },
  uiSchema: {
    type: 'tab',
    contents: [
      {
        type: 'contentList',
        key: 'testA',
        content: {
          type: 'form',
          contents: [
            {type: 'text', key: '$key', label: 'キー'},
            {type: 'text', key: 'testA1'},
            {type: 'select', key: 'testA2', emptyToNull: true},
            {
              type: 'tab',
              key: 'testA3',
              contents: [
                {
                  type: 'form',
                  key: 'testA3a',
                  contents: [
                    {type: 'text', key: 'testA3a1'},
                    {type: 'text', key: 'testA3a2'},
                  ],
                },
                {
                  type: 'form',
                  key: 'testA3b',
                  contents: [
                    {type: 'text', key: 'testA3b1'},
                    {type: 'text', key: 'testA3b2'},
                    {
                      type: 'contentList',
                      key: 'testA3b3',
                      content: {
                        type: 'form',
                        contents: [
                          {type: 'text', key: 'testA3b3a'},
                          {type: 'text', key: 'testA3b3b'},
                        ],
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'tab',
              key: 'testA4',
              contents: [
                {
                  type: 'form',
                  key: 'testA4a',
                  contents: [
                    {type: 'text', key: 'testA4a1'},
                    {type: 'text', key: 'testA4a2'},
                  ],
                },
                {
                  type: 'form',
                  key: 'testA4b',
                  contents: [
                    {type: 'text', key: 'testA4b1'},
                    {type: 'text', key: 'testA4b2'},
                  ],
                },
              ],
            },
            {
              type: 'table',
              key: 'testA5',
              contents: [
                {type: 'text', key: '$key'},
                {type: 'text', key: 'testA5a'},
                {type: 'text', key: 'testA5b'},
                {type: 'select', key: 'testA5c'},
                {type: 'checkbox', key: 'testA5d'},
                {type: 'number', key: 'testA5e'},
                {type: 'select', key: 'testA5f', isMulti: true},
              ],
            },
            {
              type: 'checkbox',
              key: 'testA6',
            },
            {
              type: 'number',
              key: 'testA7',
            },
            {
              type: 'mappingTable',
              key: 'testA8',
              sourcePath: '../testA5',
              contents: [
                {type: 'text', key: 'testA8a'},
                {type: 'number', key: 'testA8b'},
                {type: 'select', key: 'testA8c'},
                {type: 'checkbox', key: 'testA8d'},
              ],
            },
            {
              type: 'select',
              key: 'testA9',
              isMulti: true,
            },
            {
              type: 'table',
              key: 'testA10',
              contents: [
                {type: 'text', key: '$key'},
                {type: 'text', key: 'testA10a'},
                {type: 'select', key: 'testA10b'},
              ],
            },
            {
              type: 'text',
              key: 'testA11',
              multiline: true,
            },
            {
              type: 'tab',
              key: 'testA12',
              contents: [
                {
                  type: 'contentList',
                  key: 'testA12a',
                  content: {
                    type: 'form',
                    contents: [
                      {type: 'text', key: 'testA12a1'},
                      {type: 'text', key: 'testA12a2'},
                    ],
                  },
                },

                {
                  type: 'contentList',
                  key: 'testA12b',
                  content: {
                    type: 'form',
                    contents: [],
                  },
                },
              ],
            },
            {
              type: 'conditional',
              key: 'testA13',
              conditionalContents: {
                testA13a: {
                  type: 'form',
                  contents: [{type: 'select', key: 'type'}],
                },
              },
            },
          ],
        },
      },
      {
        type: 'form',
        key: 'testB',
        contents: [
          {type: 'text', key: 'testB1'},
          {type: 'text', key: 'testB2'},
        ],
      },
    ],
  },
};
