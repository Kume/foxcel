import ObjectDataStorage from '../ObjectDataStorage';
import DataMapper, {FileDataMapNode} from '../DataMapper';
import {RawStorageDataTrait} from '../StorageDataTrait';
import {DataMapperConfig} from '../../common/ConfigTypes';

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
        'Anther file with single type',
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
        const mapper = DataMapper.build(testDatum.mapperConfig, storage, RawStorageDataTrait);
        const fileMap = await mapper.saveAsync({}, testDatum.data);
        expect(storage.data).toEqual(testDatum.file);
        expect(fileMap).toEqual(testDatum.fileMap);
      });

      it(`Load with [${key}]`, async () => {
        const storage = new ObjectDataStorage();
        for (const filePath of Object.keys(testDatum.file)) {
          await storage.saveAsync(filePath.split('/'), testDatum.file[filePath]);
        }
        const mapper = DataMapper.build(testDatum.mapperConfig, storage, RawStorageDataTrait);
        const loaded = await mapper.loadAsync();
        expect(loaded?.rootNode).toEqual(testDatum.fileMap);
      });
    });

    it('should delete file for deleted data', async () => {
      const childData = {d: {e: 20}};
      const data = {a: {b: childData, c: 9}};
      const config: DataMapperConfig = {
        children: [
          {type: 'map', path: 'a', directory: 'a', children: [{type: 'single', path: 'd', fileName: 'd.yml'}]},
        ],
      };
      const storage = new ObjectDataStorage();
      const mapper = DataMapper.build(config, storage, RawStorageDataTrait);
      const firstNode = await mapper.saveAsync({}, data);
      expect(storage.data['a/b/d.yml']).not.toBeUndefined();
      expect(storage.data['a/b.yml']).not.toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      storage.clearHistory();

      const secondData = {a: {...data.a, b: {}}};
      const secondNode = await mapper.saveAsync(firstNode, secondData);
      expect(storage.data['a/b/d.yml']).toBeUndefined();
      expect(storage.data['a/b.yml']).not.toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      expect(storage.writeHistory.length).toBe(2); // index.yml, a/b.yml
      expect(storage.deleteHistory).toEqual([['a', 'b', 'd.yml']]);
      storage.clearHistory();

      const thirdData = {a: {c: 9}};
      await mapper.saveAsync(secondNode, thirdData);
      expect(storage.data['a/b/d.yml']).toBeUndefined();
      expect(storage.data['a/b.yml']).toBeUndefined();
      expect(storage.data['a/c.yml']).not.toBeUndefined();
      expect(storage.writeHistory.length).toBe(1); // index.yml
      expect(storage.deleteHistory).toEqual([['a', 'b.yml']]);
    });
  });
});
