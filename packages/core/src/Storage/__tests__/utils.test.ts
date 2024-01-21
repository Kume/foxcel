import {loadNestedConfigFile} from '../utils';
import {WritableFileBaseNamedItemNode} from '../../common/commonTypes';
import {ObjectDataStorage} from '../ObjectDataStorage';
import {YamlDataFormatter} from '../YamlDataFormatter';

interface Config {
  name: string;
}

function testValidate(data: unknown): void {
  if (typeof data === 'object' && data !== null) {
    return;
  }
  throw new Error(`Config is unexpected type. ${typeof data}`);
}

type ConfigMap = {readonly [key: string]: string | Config};

describe('Unit tests for loadNestedConfigFile', () => {
  it('Load complex data', async () => {
    const namedDataSchema: WritableFileBaseNamedItemNode<Config> = {filePath: []};
    const loadedDataSchema = new Map([['', namedDataSchema]]);
    const storage = new ObjectDataStorage();
    const rootConfig = {sub: 'sub/1.yml', rootNamed1: {name: 'root1'}, rootNamed2: {name: 'root2'}} satisfies ConfigMap;
    const sub1Config = {subNamed1: {name: 'sub1'}, subSub: '2.yml'} satisfies ConfigMap;
    const sub2Config = {subNamed2: {name: 'sub2'}} satisfies ConfigMap;
    await storage.saveAsync(['sub', '1.yml'], JSON.stringify(sub1Config));
    await storage.saveAsync(['sub', '2.yml'], JSON.stringify(sub2Config));
    await loadNestedConfigFile(
      rootConfig,
      namedDataSchema,
      loadedDataSchema,
      testValidate,
      storage,
      new YamlDataFormatter(),
    );

    const rootNode = loadedDataSchema.get('');
    const sub1Node = loadedDataSchema.get('sub/1.yml');
    const sub2Node = loadedDataSchema.get('sub/2.yml');

    // 値がstringなプロパティ(sub: 'sub/1.yml')はrefsとして格納される。
    expect(rootNode?.refs?.size).toBe(1);
    expect(rootNode?.refs?.get('sub')).toEqual(sub1Node);

    // 値がstringでないプロパティ(rootNamed1, rootNamed2)はnamedとして格納される。
    expect(rootNode?.named?.size).toBe(2);
    expect(rootNode?.named?.get('rootNamed1')).toEqual(rootConfig.rootNamed1);
    expect(rootNode?.named?.get('rootNamed2')).toEqual(rootConfig.rootNamed2);

    //// root以外も同様の動作をする。
    // 値がstringなプロパティ(subSub: '2.yml')はrefsとして格納される。
    expect(sub1Node?.refs?.size).toBe(1);
    expect(sub1Node?.refs?.get('subSub')).toEqual(sub2Node);

    // 値がstringでないプロパティ(subNamed1)はnamedとして格納される。
    expect(sub1Node?.named?.size).toBe(1);
    expect(sub1Node?.named?.get('subNamed1')).toEqual(sub1Config.subNamed1);

    // それぞれファイルパスが正しく格納されている。
    expect(sub1Node?.filePath).toEqual(['sub', '1.yml']);
    expect(sub2Node?.filePath).toEqual(['sub', '2.yml']);
  });
});
