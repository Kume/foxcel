import ObjectDataStorage from '../ObjectDataStorage';
import DataMapper, {FileDataMapNode} from '../DataMapper';
import {RawStorageDataTrait} from '../StorageDataTrait';
import {DataMapperConfig} from '../../common/ConfigTypes';
import {dataModelToJson, unknownToDataModel} from '../../DataModel/DataModel';
import {applyDataModelActions, DataModelAction} from '../../DataModel/DataModelAction';
import {dataModelStorageDataTrait} from '../../DataModel/DataModelStorageDataTrait';

describe('Unit Test for DataMapper', () => {
  describe('Common save and load test', () => {
    interface TestData {
      mapperConfig: DataMapperConfig;
      data: unknown;
      file: {[key: string]: string};
      fileMap: FileDataMapNode<unknown>;
    }

    const testData = new Map<string, TestData>([
      [
        'single file',
        {
          mapperConfig: {children: []},
          data: {a: 2},
          file: {'index.yml': 'a: 2\n'},
          fileMap: {children: {'index.yml': {data: {a: 2}}}},
        },
      ],
      [
        'single type',
        {
          mapperConfig: {
            children: [{type: 'single', fileName: 'sub.yml', path: 'b', directory: ''}],
          },
          data: {a: 2, b: {c: 9}},
          file: {
            'index.yml': 'a: 2\nb: sub.yml\n',
            'sub.yml': 'c: 9\n',
          },
          fileMap: {children: {'index.yml': {data: {a: 2, b: {c: 9}}}, 'sub.yml': {data: {c: 9}}}},
        },
      ],
      [
        'single type with directory',
        {
          mapperConfig: {
            children: [{type: 'single', fileName: 'sub.yml', path: 'b', directory: 'sub_dir'}],
          },
          data: {a: 2, b: {c: 9}},
          file: {
            'index.yml': 'a: 2\nb: sub_dir/sub.yml\n',
            'sub_dir/sub.yml': 'c: 9\n',
          },
          fileMap: {
            children: {'index.yml': {data: {a: 2, b: {c: 9}}}, sub_dir: {children: {'sub.yml': {data: {c: 9}}}}},
          },
        },
      ],
      [
        'Multi file with map type',
        {
          mapperConfig: {
            children: [{type: 'map', path: 'z', directory: 'sub'}],
          },
          data: {z: {a: 2, b: 5, c: 9}},
          file: {
            'index.yml': 'z:\n  a: sub/a.yml\n  b: sub/b.yml\n  c: sub/c.yml\n',
            'sub/a.yml': '2\n',
            'sub/b.yml': '5\n',
            'sub/c.yml': '9\n',
          },
          fileMap: {
            children: {
              'index.yml': {data: {z: {a: 2, b: 5, c: 9}}},
              sub: {
                children: {
                  'a.yml': {data: 2},
                  'b.yml': {data: 5},
                  'c.yml': {data: 9},
                },
              },
            },
          },
        },
      ],
      [
        'Single type under map type',
        {
          mapperConfig: {
            children: [
              {
                type: 'map',
                path: 'z',
                directory: 'sub',
                children: [{type: 'single', path: 'd', directory: '', fileName: 'subsub.yml'}],
              },
            ],
          },
          data: {z: {a: 2, c: {d: 20, e: 97}}},
          file: {
            'index.yml': 'z:\n  a: sub/a.yml\n  c: sub/c.yml\n',
            'sub/a.yml': '2\n',
            'sub/c.yml': 'd: c/subsub.yml\ne: 97\n',
            'sub/c/subsub.yml': '20\n',
          },
          fileMap: {
            children: {
              'index.yml': {data: {z: {a: 2, c: {d: 20, e: 97}}}},
              sub: {
                children: {
                  'a.yml': {data: 2},
                  'c.yml': {data: {d: 20, e: 97}},
                  c: {
                    children: {
                      'subsub.yml': {data: 20},
                    },
                  },
                },
              },
            },
          },
        },
      ],
      [
        'Map type under single type',
        {
          mapperConfig: {
            children: [
              {
                type: 'single',
                path: 'a',
                directory: 'sub',
                fileName: 'index.yml',
                children: [{type: 'map', path: 'c', directory: 'subdir'}],
              },
            ],
          },
          data: {a: {c: {d: 20, e: 97}}, b: 5},
          file: {
            'index.yml': 'a: sub/index.yml\nb: 5\n',
            'sub/index.yml': 'c:\n  d: subdir/d.yml\n  e: subdir/e.yml\n',
            'sub/subdir/d.yml': '20\n',
            'sub/subdir/e.yml': '97\n',
          },
          fileMap: {
            children: {
              'index.yml': {data: {a: {c: {d: 20, e: 97}}, b: 5}},
              sub: {
                children: {
                  'index.yml': {data: {c: {d: 20, e: 97}}},
                  subdir: {
                    children: {
                      'd.yml': {data: 20},
                      'e.yml': {data: 97},
                    },
                  },
                },
              },
            },
          },
        },
      ],
    ]);

    testData.forEach((testDatum: TestData, key: string) => {
      it(`Save with [${key}]`, async () => {
        const storage = new ObjectDataStorage();
        const mapper = DataMapper.build(testDatum.mapperConfig);
        const fileMap = await mapper.saveAsync({}, testDatum.data, storage, RawStorageDataTrait);
        expect(storage.data).toEqual(testDatum.file);
        expect(fileMap).toEqual(testDatum.fileMap);

        // makeFileDataMapでも同じfileMapを生成する必要がある
        const fileMapWithoutSave = mapper.makeFileDataMap(testDatum.data, RawStorageDataTrait);
        expect(fileMapWithoutSave).toEqual(testDatum.fileMap);
      });

      it(`Load with [${key}]`, async () => {
        const storage = new ObjectDataStorage();
        for (const filePath of Object.keys(testDatum.file)) {
          await storage.saveAsync(filePath.split('/'), testDatum.file[filePath]);
        }
        const mapper = DataMapper.build(testDatum.mapperConfig);
        const loaded = await mapper.loadAsync(storage, RawStorageDataTrait);
        expect(loaded?.rootNode).toEqual(testDatum.fileMap);
      });
    });

    it('When data is deleted, the corresponding file should also be deleted.', async () => {
      const childData = {d: {e: 20}};
      const data = {a: {b: childData, c: 9}};
      const config: DataMapperConfig = {
        children: [
          {type: 'map', path: 'a', directory: 'a', children: [{type: 'single', path: 'd', fileName: 'd.yml'}]},
        ],
      };
      const storage = new ObjectDataStorage();
      const mapper = DataMapper.build(config);
      const firstNode = await mapper.saveAsync({}, data, storage, RawStorageDataTrait);
      expect(storage.data['a/b/d.yml']).not.toBeUndefined();
      expect(storage.data['a/b.yml']).not.toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      storage.clearHistory();

      const secondData = {a: {...data.a, b: {}}};
      const secondNode = await mapper.saveAsync(firstNode, secondData, storage, RawStorageDataTrait);
      expect(storage.data['a/b/d.yml']).toBeUndefined();
      expect(storage.data['a/b.yml']).not.toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      expect(storage.writeHistory.length).toBe(2); // index.yml, a/b.yml
      expect(storage.deleteHistory).toEqual([['a', 'b', 'd.yml']]);
      storage.clearHistory();

      const thirdData = {a: {c: 9}};
      await mapper.saveAsync(secondNode, thirdData, storage, RawStorageDataTrait);
      expect(storage.data['a/b/d.yml']).toBeUndefined();
      expect(storage.data['a/b.yml']).toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      expect(storage.writeHistory.length).toBe(1); // index.yml
      expect(storage.deleteHistory).toEqual([['a', 'b.yml']]);
    });
  });

  describe('データの差分に応じて必要十分なデータ更新が行われることの確認', () => {
    const complexMapper = DataMapper.build({
      children: [
        {
          type: 'map',
          path: '_map',
          directory: '__map',
          children: [
            {type: 'single', path: 'single_1', fileName: 'single_1.yml'},
            {type: 'map', path: 'map_a', directory: 'map_a'},
          ],
        },
        {
          type: 'single',
          path: '_single',
          fileName: 'single.yml',
          directory: '_single_dir',
          children: [
            {type: 'map', path: 'map_b', directory: 'map_b'},
            {type: 'single', path: 'single_2', fileName: 'single_2.yml'},
          ],
        },
        {
          type: 'single',
          path: '_single_3',
          fileName: 'single_3.yml',
        },
      ],
    });

    const baseData = unknownToDataModel({
      _map: {
        a: {
          single_1: 'a_single1_content',
          map_a: {
            a: 'a_a_content',
            b: 'a_b_content',
            c: 'a_c_content',
          },
        },
        b: {
          map_a: {
            a: 'b_a_content',
            b: 'b_b_content',
          },
        },
        c: 'map_c_content',
      },
      _single: {
        single_2: 'single2_content',
        map_b: {
          a: 'single_a_content',
          b: 'single_b_content',
        },
      },
      _single_3: 'single3_content',
    });

    interface TestData {
      readonly label: string;
      readonly initialDataActions?: DataModelAction[];
      readonly mainDataActions?: DataModelAction[];
      readonly expectedWriteHistory?: ObjectDataStorage['writeHistory'];
      readonly expectedDeleteHistory?: ObjectDataStorage['deleteHistory'];
    }

    const testData: readonly TestData[] = [
      {
        label: 'Not updated',
        expectedWriteHistory: [],
      },
      // TODO todo ルートデータのみが変更されたときのテストケース
      {
        label: 'Add simple single type',
        initialDataActions: [{type: 'delete', path: {components: ['_single_3']}}],
        mainDataActions: [
          {type: 'set', path: {components: ['_single_3']}, data: unknownToDataModel('added_single3_content')},
        ],
        expectedWriteHistory: [
          [['single_3.yml'], 'added_single3_content\n'],
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
      },
      {
        label: 'Update simple single type',
        mainDataActions: [
          {type: 'set', path: {components: ['_single_3']}, data: unknownToDataModel('updated_single3_content')},
        ],
        expectedWriteHistory: [
          [['single_3.yml'], 'updated_single3_content\n'],
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
      },
      {
        label: 'Delete simple single type',
        mainDataActions: [{type: 'delete', path: {components: ['_single_3']}}],
        expectedWriteHistory: [
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
        expectedDeleteHistory: [['single_3.yml']],
      },
      {
        label: 'Add simple map type',
        mainDataActions: [{type: 'set', path: {components: ['_map', 'x']}, data: unknownToDataModel('added_map_x')}],
        expectedWriteHistory: [
          [['__map', 'x.yml'], 'added_map_x\n'],
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
      },
      {
        label: 'Update simple map type',
        mainDataActions: [{type: 'set', path: {components: ['_map', 'c']}, data: unknownToDataModel('updated_map_c')}],
        expectedWriteHistory: [
          [['__map', 'c.yml'], 'updated_map_c\n'],
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
      },
      {
        label: 'Delete simple map type',
        mainDataActions: [{type: 'delete', path: {components: ['_map', 'c']}}],
        expectedWriteHistory: [
          [['index.yml'], expect.anything()], // 現状は更新対象より親のファイルはすべて更新される仕様
        ],
        expectedDeleteHistory: [['__map', 'c.yml']],
      },
      {
        label: 'Add single type under map type',
        mainDataActions: [
          {
            type: 'set',
            path: {components: ['_map', 'b', 'single_1']},
            data: unknownToDataModel('added_single1_content'),
          },
        ],
        expectedWriteHistory: [
          [['__map', 'b', 'single_1.yml'], 'added_single1_content\n'],
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'b.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
      },
      {
        label: 'Update single type under map type',
        mainDataActions: [
          {
            type: 'set',
            path: {components: ['_map', 'a', 'single_1']},
            data: unknownToDataModel('updated_single1_content'),
          },
        ],
        expectedWriteHistory: [
          [['__map', 'a', 'single_1.yml'], 'updated_single1_content\n'],
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'a.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
      },
      {
        label: 'Delete single type under map type',
        mainDataActions: [{type: 'delete', path: {components: ['_map', 'a', 'single_1']}}],
        expectedWriteHistory: [
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'a.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
        expectedDeleteHistory: [['__map', 'a', 'single_1.yml']],
      },
      {
        label: 'Add map type under map type',
        mainDataActions: [
          {type: 'set', path: {components: ['_map', 'a', 'map_a', 'x']}, data: unknownToDataModel('added_map_x')},
        ],
        expectedWriteHistory: [
          [['__map', 'a', 'map_a', 'x.yml'], 'added_map_x\n'],
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'a.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
      },
      {
        label: 'Update map type under map type',
        mainDataActions: [
          {type: 'set', path: {components: ['_map', 'a', 'map_a', 'a']}, data: unknownToDataModel('updated_map_c')},
        ],
        expectedWriteHistory: [
          [['__map', 'a', 'map_a', 'a.yml'], 'updated_map_c\n'],
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'a.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
      },
      {
        label: 'Delete map type under map type',
        mainDataActions: [{type: 'delete', path: {components: ['_map', 'a', 'map_a', 'a']}}],
        expectedWriteHistory: [
          // 現状は更新対象より親のファイルはすべて更新される仕様
          [['__map', 'a.yml'], expect.anything()],
          [['index.yml'], expect.anything()],
        ],
        expectedDeleteHistory: [['__map', 'a', 'map_a', 'a.yml']],
      },
    ];

    describe.each(testData)(
      `ファイル更新確認 - $label`,
      ({initialDataActions, mainDataActions, expectedWriteHistory, expectedDeleteHistory}) => {
        const initialModel = initialDataActions
          ? applyDataModelActions(baseData, undefined, initialDataActions)
          : baseData;
        const initialMap = complexMapper.makeFileDataMap(initialModel, dataModelStorageDataTrait);
        const updatedModel = mainDataActions
          ? applyDataModelActions(initialModel, undefined, mainDataActions)
          : initialModel;

        it('通常更新-更新履歴', async () => {
          const storage = new ObjectDataStorage();
          await complexMapper.saveAsync(initialMap, updatedModel, storage, dataModelStorageDataTrait);
          expect(storage.writeHistory).toEqual(expectedWriteHistory ?? []);
        });

        it('通常更新-削除履歴', async () => {
          const storage = new ObjectDataStorage();
          await complexMapper.saveAsync(initialMap, updatedModel, storage, dataModelStorageDataTrait);
          expect(storage.deleteHistory).toEqual(expectedDeleteHistory ?? []);
        });

        it('一度シリアライズした後更新', async () => {
          const dirtyNode = JSON.parse(
            JSON.stringify(complexMapper.makeDirtyFileMapNode(initialMap, updatedModel, dataModelStorageDataTrait)),
          );
          const deserializedModel = unknownToDataModel(
            updatedModel === undefined ? undefined : dataModelToJson(updatedModel),
          );
          const restoredMap = complexMapper.makeFileDataMap(deserializedModel, dataModelStorageDataTrait, dirtyNode);
          const storage = new ObjectDataStorage();
          await complexMapper.saveAsync(restoredMap, deserializedModel, storage, dataModelStorageDataTrait);
          expect(storage.writeHistory).toEqual(expectedWriteHistory ?? []);
          expect(storage.deleteHistory).toEqual(expectedDeleteHistory ?? []);
        });
      },
    );
  });
});
