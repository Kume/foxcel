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
