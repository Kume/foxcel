import {DataSchemaConfig, RootSchemaConfig, UISchemaConfig} from './common/ConfigTypes';
import {mapObjectToObject} from './common/utils';
import {unknownToDataModel} from './DataModel/DataModel';

interface SchemaPair {
  readonly data: DataSchemaConfig;
  readonly ui: UISchemaConfig;
}

type SchemaPairMap = Record<string, SchemaPair>;

function schemaPairMapToDataItems(map: SchemaPairMap): Record<string, DataSchemaConfig> {
  return mapObjectToObject(map, (value) => value.data);
}

function schemaPairMapToUIContents(map: SchemaPairMap): readonly UISchemaConfig[] {
  return Object.entries(map).map(([key, value]) => ({key, ...value.ui}));
}

export class FullSpecSchemaSample {
  public static rootSchema(): RootSchemaConfig {
    return {
      dataSchema: {
        type: 'fixed_map',
        items: {
          simple: {
            type: 'map',
            label: 'シンプルなフォーム',
            item: {
              type: 'fixed_map',
              items: schemaPairMapToDataItems(this.simpleFormItemMap()),
            },
          },
        },
      },
      uiRoot: {
        type: 'tab',
        contents: [
          {
            type: 'contentList',
            key: 'simple',
            content: {
              type: 'form',
              contents: [
                {type: 'text', key: '$key', label: 'キー入力'},
                ...schemaPairMapToUIContents(this.simpleFormItemMap()),
              ],
            },
          },
        ],
      },
      fileMap: {children: []},
    };
  }

  public static basicInitialData() {
    return unknownToDataModel({
      simple: {
        first: {
          tableAsMap: {a: null, b: null},
          tableAsList: [null, null, null],
        },
        second: null,
      },
    });
  }

  public static simpleFormItemMap() {
    return {
      ...this.basicItemMap(),
      tableAsMap: {
        data: {
          type: 'map',
          label: 'テーブル入力(Map)',
          item: {
            type: 'fixed_map',
            items: schemaPairMapToDataItems(this.basicItemMap()),
          },
        },
        ui: {
          type: 'table',
          contents: [{type: 'text', key: '$key', label: 'キー入力'}, ...schemaPairMapToUIContents(this.basicItemMap())],
        },
      },
      tableAsList: {
        data: {
          type: 'list',
          label: 'テーブル入力(List)',
          item: {
            type: 'fixed_map',
            items: schemaPairMapToDataItems(this.basicItemMap()),
          },
        },
        ui: {type: 'table', contents: schemaPairMapToUIContents(this.basicItemMap())},
      },
      mappingTable: {
        data: {
          type: 'map',
          label: 'マッピングテーブル',
          item: {type: 'fixed_map', items: schemaPairMapToDataItems(this.basicItemMap())},
        },
        ui: {
          type: 'mappingTable',
          sourcePath: '../tableAsMap',
          contents: schemaPairMapToUIContents(this.basicItemMap()),
        },
      },
    } as const satisfies SchemaPairMap;
  }

  public static basicItemMap() {
    return {
      singleLineText: {
        data: {type: 'string', label: 'テキスト入力'},
        ui: {type: 'text'},
      },
      multiLineText: {
        data: {type: 'string', label: '複数行テキスト入力'},
        ui: {type: 'text', multiline: true},
      },
      number: {
        data: {type: 'number', label: '数値入力'},
        ui: {type: 'number'},
      },
      check: {
        data: {type: 'boolean', label: 'チェックボックス'},
        ui: {type: 'checkbox'},
      },
      select: {
        data: {type: 'string', label: '選択', in: ['A', 'B', 'C']},
        ui: {type: 'select'},
      },
    } as const satisfies SchemaPairMap;
  }
}

export class RecursiveSchemaSample {
  public static rootSchema(): RootSchemaConfig {
    return {
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
  }

  public static basicInitialData() {
    return unknownToDataModel({
      root: [
        {
          label: 'test1',
          children: [
            {label: 'test1-1', children: []},
            {label: 'test1-2', children: []},
          ],
        },
        {
          label: 'test2',
          children: [],
        },
      ],
    });
  }
}

export class DBSchemaSample {
  public static rootSchema(): RootSchemaConfig {
    return {
      dataSchema: {
        type: 'fixed_map',
        items: {
          tables: {
            type: 'map',
            label: 'テーブル定義一覧',
            item: {
              type: 'fixed_map',
              label: 'テーブル定義',
              dataLabel: '{{label}}',
              contextKey: 'table',
              items: {
                label: 'label',
                description: 'description',
                columns: {
                  type: 'map',
                  label: 'カラム定義一覧',
                  item: {
                    type: 'fixed_map',
                    label: 'カラム定義',
                    items: {
                      label: 'label',
                      description: 'description',
                      type: {
                        type: 'string',
                        label: '型',
                        in: ['INT', 'SMALLINT', 'VARCHAR', 'TEXT', 'DATETIME'],
                      },
                      length: {type: 'number', label: 'データ長'},
                      nullable: {type: 'boolean', label: 'NULL許可'},
                    },
                  },
                },
                indexes: {
                  type: 'map',
                  label: 'インデックス一覧',
                  item: {
                    type: 'fixed_map',
                    label: 'インデックス',
                    items: {
                      unique: {type: 'boolean', label: 'ユニーク'},
                      column1: {
                        type: 'string',
                        label: '対象カラム(1)',
                        in: [{path: 'table:columns/*/$key'}],
                      },
                      column2: {
                        type: 'string',
                        label: '対象カラム(2)',
                        in: [{path: 'table:columns/*/$key'}],
                      },
                      column3: {
                        type: 'string',
                        label: '対象カラム(3)',
                        in: [{path: 'table:columns/*/$key'}],
                      },
                      column4: {
                        type: 'string',
                        label: '対象カラム(4)',
                        in: [{path: 'table:columns/*/$key'}],
                      },
                      column5: {
                        type: 'string',
                        label: '対象カラム(5)',
                        in: [{path: 'table:columns/*/$key'}],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      namedDataSchema: {
        label: {type: 'string', label: '名前'},
        description: {type: 'string', label: '説明'},
      },
      namedUiSchema: {
        physicalName: {type: 'text', label: '物理名', key: '$key'},
        label: {type: 'text', key: 'label'},
        description: {type: 'text', key: 'description', multiline: true},
      },
      uiRoot: {
        type: 'tab',
        contents: [
          {
            type: 'contentList',
            key: 'tables',
            content: {
              type: 'form',
              contents: [
                {type: 'text', label: '物理名', key: '$key'},
                {type: 'text', key: 'label'},
                {type: 'text', key: 'description', multiline: true},
                {
                  type: 'table',
                  key: 'columns',
                  contents: [
                    {type: 'text', label: '物理名', key: '$key'},
                    {type: 'text', key: 'label'},
                    {type: 'select', key: 'type'},
                    {type: 'number', key: 'length'},
                    {type: 'checkbox', key: 'nullable'},
                    {type: 'text', key: 'description', multiline: true},
                  ],
                },
                {
                  type: 'table',
                  key: 'indexes',
                  contents: [
                    {type: 'text', label: '物理名', key: '$key'},
                    {type: 'checkbox', key: 'unique'},
                    {type: 'select', key: 'column1'},
                    {type: 'select', key: 'column2'},
                    {type: 'select', key: 'column3'},
                    {type: 'select', key: 'column4'},
                    {type: 'select', key: 'column5'},
                    {type: 'text', key: 'description', multiline: true},
                  ],
                },
              ],
            },
          },
        ],
      },
      fileMap: {children: []},
    };
  }

  public static basicInitialData() {
    return unknownToDataModel({
      tables: {
        user: {
          label: 'ユーザー',
          columns: {
            id: {label: 'ID', type: 'INT'},
            first_name: {label: '名', type: 'TEXT'},
            last_name: {label: '姓', type: 'TEXT'},
          },
          indexes: {
            name: {
              column1: 'first_name',
            },
          },
        },
      },
    });
  }
}
