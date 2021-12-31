import {RootSchemaConfig} from 'co-doc-editor-core';

export const sampleConfig: RootSchemaConfig = {
  dataSchema: {
    type: 'fixed_map',
    items: {
      testA: {
        type: 'map',
        label: 'テストA一覧',
        item: {
          type: 'fixed_map',
          label: 'テストA',
          items: {
            testA1: {type: 'string', label: 'てすとA1'},
            testA2: {type: 'string', label: 'テストA2は長めのラベル名'},
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
    key: 'dummy',
    contents: [
      {
        type: 'contentList',
        key: 'testA',
        content: {
          type: 'form',
          contents: [
            {type: 'text', key: 'testA1'},
            {type: 'text', key: 'testA2'},
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
