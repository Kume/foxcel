/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  BooleanDataModel,
  DataModel,
  DataModelType,
  FloatDataModel,
  IntegerDataModel,
  ListDataModel,
  MapDataModel,
  NullDataModel,
  StringDataModel,
} from '../DataModelTypes';
import {
  dataModelEqualsToUnknown,
  dataModelIsList,
  dataModelIsMap,
  dataModelToJson,
  getFromDataModel,
  getListDataAt,
  getMapDataAtIndex,
  getMapKeyAtIndex,
  mapDataLastElement,
  mapDataSize,
  nullDataModel,
  pushToDataModel,
  setToDataModel,
  setToDataModelRecursive,
  SimplePathContainer,
  unknownToDataModel,
} from '../DataModel';
import {configFixtures, dataSchemaFixture, dataSchemaForFixture} from '../../common/testFixtures';
import {buildDataSchema} from '../DataSchema';
import {YamlDataFormatter} from '../../Storage/YamlDataFormatter';
import {ObjectDataStorage} from '../../Storage/ObjectDataStorage';
import {parsePath} from '../DataPath';
import {getDataModelByForwardPath} from '../DataModelCollector';
import {DataModelContext} from '../DataModelContext';

function getByPath(model: DataModel, path: string): DataModel | undefined {
  return getDataModelByForwardPath(model, parsePath(path, 'forward'));
}

describe('Unit tests for unknownToDataModel', () => {
  it('To IntegerDataModel', () => {
    const dataModel = unknownToDataModel(1) as IntegerDataModel;
    expect(dataModel).toBe(1);
  });

  it('To FloatDataModel', () => {
    const dataModel = unknownToDataModel(1.1) as FloatDataModel;
    expect(dataModel).toBe(1.1);
  });

  it('To StringDataModel', () => {
    const dataModel = unknownToDataModel('test') as StringDataModel;
    expect(dataModel).toBe('test');
  });

  it('To BooleanDataModel (true)', () => {
    const dataModel = unknownToDataModel(true) as BooleanDataModel;
    expect(dataModel).toBe(true);
  });

  it('To BooleanDataModel (false)', () => {
    const dataModel = unknownToDataModel(false) as BooleanDataModel;
    expect(dataModel).toBe(false);
  });

  it('To NullDataModel', () => {
    const dataModel = unknownToDataModel(null) as NullDataModel;
    expect(dataModel).toBe(null);
  });

  it('To ListDataModel', () => {
    const dataModel = unknownToDataModel([1, 'b', null]) as ListDataModel;
    expect(dataModelIsList(dataModel)).toBeTruthy();
    expect(getListDataAt(dataModel, 0)).toBe(1);
    expect(getListDataAt(dataModel, 1)).toBe('b');
    expect(getListDataAt(dataModel, 2)).toBe(null);
  });

  it('To MapDataModel', () => {
    const dataModel = unknownToDataModel({a: 1, c: null, b: 'test'}) as MapDataModel;
    expect(dataModel.t).toBe(DataModelType.Map);
    expect(getMapKeyAtIndex(dataModel, 0)).toBe('a');
    expect(getMapDataAtIndex(dataModel, 0)).toBe(1);
    expect(getMapKeyAtIndex(dataModel, 1)).toBe('c'); // 辞書順でなく、オブジェクトの定義順になる。
    expect(getMapDataAtIndex(dataModel, 1)).toBe(nullDataModel);
    expect(getMapKeyAtIndex(dataModel, 2)).toBe('b');
    expect(getMapDataAtIndex(dataModel, 2)).toBe('test');
  });

  it('To Nested', () => {
    const dataModel = unknownToDataModel({a: 1, c: ['b', {c: null}]}) as MapDataModel;
    expect(dataModelIsMap(dataModel)).toBeTruthy();
    const listDataModel = getMapDataAtIndex(dataModel, 1) as ListDataModel;
    expect(dataModelIsList(listDataModel)).toBeTruthy();
    const childMapDataModel = getListDataAt(listDataModel, 1) as MapDataModel;
    expect(getMapDataAtIndex(childMapDataModel, 0)).toBe(null);
  });
});

describe('Unit tests for dataModelEqualsToUnknown', () => {
  // equal
  [
    {label: 'integer', value: 1},
    {label: 'float', value: 1.1},
    {label: 'true', value: true},
    {label: 'false', value: false},
    {label: 'null', value: null},
    {label: 'list', value: [1, 'a', false]},
    {label: 'map', value: {1: 'a', b: 'c'}},
    {label: 'nested map', value: {1: 'a', b: ['c', 8, {d: 'e'}]}},
  ].map(({label, value}) => {
    it(`${label} type data model is equal to raw value`, () => {
      const result = dataModelEqualsToUnknown(unknownToDataModel(value), value);
      expect(result).toBe(true);
    });
  });

  // not equal
  [
    [1, 1.1],
    ['1', 1],
    ['a', 'aa'],
    [true, false],
    [
      [1, 2],
      [1, 2, 3],
    ],
    [
      [1, 2],
      [1, '2'],
    ],
    [{a: '1'}, {a: 1}],
    [{a: 1}, {a: 1, b: 2}],
    [
      {a: 1, b: '2'},
      {a: 1, b: 2},
    ],
  ].map(([leftValue, rightValue]) => {
    it(`data model ${JSON.stringify(leftValue)} is not equal to raw value ${JSON.stringify(rightValue)}`, () => {
      const result = dataModelEqualsToUnknown(unknownToDataModel(leftValue), rightValue);
      expect(result).toBe(false);
    });

    it(`data model ${JSON.stringify(rightValue)} is not equal to raw value ${JSON.stringify(leftValue)}`, () => {
      const result = dataModelEqualsToUnknown(unknownToDataModel(rightValue), leftValue);
      expect(result).toBe(false);
    });
  });

  it('Map data order does not affect equivalence', () => {
    const model = unknownToDataModel({b: 3, a: 1}) as MapDataModel;
    const result = dataModelEqualsToUnknown(model, {a: 1, b: 3});
    expect(model.v[0][0]).toBe('b');
    expect(result).toBe(true);
  });

  it('Empty key element is ignored', () => {
    let model = unknownToDataModel({a: 1, b: 3}) as MapDataModel;
    const context = DataModelContext.createRoot({model, schema: undefined});
    model = pushToDataModel(model, SimplePathContainer.create([]), context, {
      model: unknownToDataModel('c'),
    }) as MapDataModel;
    const result = dataModelEqualsToUnknown(model, {a: 1, b: 3});
    expect(result).toBe(true);
  });
});

describe('Unit tests for setToDataModel', () => {
  it('Can set to scalar data model', () => {
    const before = unknownToDataModel(1);
    const context = DataModelContext.createRoot({model: before, schema: undefined});

    const after = setToDataModel(before, undefined, context, {model: unknownToDataModel('test')});
    expect(dataModelToJson(after!)).toBe('test');
  });

  it('Can set to list data model', () => {
    const before = unknownToDataModel(['a', 'b']);
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = setToDataModel(before, SimplePathContainer.create([1]), context, {model: unknownToDataModel('c')})!;
    expect(before).not.toBe(after);
    expect(dataModelToJson(before)).toEqual(['a', 'b']); // is immutable
    expect(dataModelToJson(after)).toEqual(['a', 'c']);
  });

  it('Can set to nested list data model', () => {
    const before = unknownToDataModel(['a', {b: [null, 'c']}]) as ListDataModel;
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = setToDataModel(before, SimplePathContainer.create([1, 'b', 1]), context, {
      model: unknownToDataModel('d'),
    }) as ListDataModel;
    expect(getListDataAt(before, 1)).not.toEqual(getListDataAt(after, 1));
    expect(dataModelToJson(before)).toEqual(['a', {b: [null, 'c']}]); // is immutable
    expect(dataModelToJson(after)).toEqual(['a', {b: [null, 'd']}]);
  });

  it('Can set to map data model', () => {
    const before = unknownToDataModel({a: 1, b: 'c'});
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = setToDataModel(before, SimplePathContainer.create(['b']), context, {model: unknownToDataModel('d')})!;
    expect(before).not.toBe(after);
    expect(dataModelToJson(before)).toEqual({a: 1, b: 'c'}); // is immutable
    expect(dataModelToJson(after)).toEqual({a: 1, b: 'd'});
  });

  it('Can set to map data model by index', () => {
    const before = unknownToDataModel({a: 1, b: 'c'});
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = setToDataModel(before, SimplePathContainer.create([1]), context, {model: unknownToDataModel('d')})!;
    expect(after).toBe(undefined);
  });

  it('Can set to nested map data model', () => {
    const before = unknownToDataModel({a: 1, b: [null, {c: 'd'}]}) as MapDataModel;
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = setToDataModel(before, SimplePathContainer.create(['b', 1, 'c']), context, {
      model: unknownToDataModel('e'),
    }) as MapDataModel;
    expect(getByPath(before, 'b/1')).not.toEqual(getByPath(after, 'b/1'));
    expect(dataModelToJson(before)).toEqual({a: 1, b: [null, {c: 'd'}]}); // is immutable
    expect(dataModelToJson(after)).toEqual({a: 1, b: [null, {c: 'e'}]});
  });

  it('2階層のMapを一度にセットできること', () => {
    const before = unknownToDataModel({}) as MapDataModel;
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModel(before, SimplePathContainer.create(['a', 'b', 'c']), context, {
      model: unknownToDataModel('d'),
    }) as MapDataModel;
    expect(dataModelToJson(after)).toEqual({a: {b: {c: 'd'}}});
  });

  it('2階層のMapを一度にセットできること(元のデータに他のキーがある場合)', () => {
    const before = unknownToDataModel({a: {unknown: {}}}) as MapDataModel;
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModel(before, SimplePathContainer.create(['a', 'b', 'c']), context, {
      model: unknownToDataModel('d'),
    }) as MapDataModel;
    expect(dataModelToJson(after)).toEqual({a: {b: {c: 'd'}, unknown: {}}});
  });

  it('Can set to children with simple recursive data schema', async () => {
    const fixture = configFixtures.simpleRecursive;
    const storage = new ObjectDataStorage();
    const dataSchema = await buildDataSchema(fixture.schema, storage, new YamlDataFormatter());
    const before = unknownToDataModel({root: [null, {children: []}]});
    const context = DataModelContext.createRoot({model: before, schema: dataSchema});
    const after1 = setToDataModel(before, SimplePathContainer.create(['root', 0, 'children']), context, {
      model: unknownToDataModel([null]),
    });
    const context2 = DataModelContext.createRoot({model: after1, schema: dataSchema});
    const after2 = setToDataModel(
      after1,
      SimplePathContainer.create(['root', 0, 'children', 0, 'children']),
      context2,
      {
        model: unknownToDataModel([]),
      },
    );
    expect(dataModelToJson(after2!)).toEqual({root: [{children: [{children: []}]}, {children: []}]});
  });
});

describe('Unit tests for setToDataModelRecursive', () => {
  it('Can set to empty map', async () => {
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const before = unknownToDataModel({});
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModelRecursive(before, SimplePathContainer.create(['empty1']), context, {
      setActions: [{path: SimplePathContainer.create(['empty2']), params: {model: unknownToDataModel({})}}],
    });
    expect(dataModelToJson(after!)).toEqual({empty1: {empty2: {}}});
  });

  it('Can set to map with existing value', () => {
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const before = unknownToDataModel({existing1: {existing2: {}}});
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModelRecursive(before, SimplePathContainer.create(['existing1']), context, {
      setActions: [{path: SimplePathContainer.create(['existing2']), params: {model: unknownToDataModel('changed')}}],
    });
    expect(dataModelToJson(after!)).toEqual({existing1: {existing2: 'changed'}});
  });

  it('同じkeyに対して2回以上セットできること', () => {
    // 途中でデータが変化するのでDataContextと実際のデータに乖離が生じるのでバグりやすい
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const before = unknownToDataModel({existing1: {existing2: {}}});
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModelRecursive(before, SimplePathContainer.create(['existing1']), context, {
      setActions: [
        {path: SimplePathContainer.create(['new', 'new1']), params: {model: unknownToDataModel('added1')}},
        {path: SimplePathContainer.create(['new', 'new2']), params: {model: unknownToDataModel('added2')}},
      ],
    });
    expect(dataModelToJson(after!)).toEqual({existing1: {existing2: {}, new: {new1: 'added1', new2: 'added2'}}});
  });

  it('Can set multiple value', () => {
    const schema = dataSchemaForFixture(dataSchemaFixture.mapMapMap);
    const before = unknownToDataModel({existing1: {}});
    const context = DataModelContext.createRoot({model: before, schema});
    const after = setToDataModelRecursive(before, SimplePathContainer.create(['existing1']), context, {
      setActions: [
        {path: SimplePathContainer.create(['test1']), params: {model: unknownToDataModel('changed1')}},
        {path: SimplePathContainer.create(['test2']), params: {model: unknownToDataModel('changed2')}},
      ],
    });
    expect(dataModelToJson(after!)).toEqual({existing1: {test1: 'changed1', test2: 'changed2'}});
  });

  it('Can set to list data', () => {
    const schema = dataSchemaForFixture(dataSchemaFixture.mapListMap);
    const before = unknownToDataModel({existing1: [{}, {}]});
    const context = DataModelContext.createRoot({model: before, schema});
    const after1 = setToDataModelRecursive(before, SimplePathContainer.create(['existing1', 1]), context, {
      setActions: [{path: SimplePathContainer.create(['test']), params: {model: unknownToDataModel('changed')}}],
    });
    expect(dataModelToJson(after1!)).toEqual({existing1: [{}, {test: 'changed'}]});

    const after2 = setToDataModelRecursive(before, SimplePathContainer.create(['existing1']), context, {
      setActions: [{path: SimplePathContainer.create([1, 'test']), params: {model: unknownToDataModel('changed')}}],
    });
    expect(dataModelToJson(after2!)).toEqual({existing1: [{}, {test: 'changed'}]});
  });

  it('Can not set to list with invalid index.', () => {
    const schema = dataSchemaForFixture(dataSchemaFixture.mapListMap);
    const before = unknownToDataModel({existing1: [{}, {}]});
    const context = DataModelContext.createRoot({model: before, schema});

    const after1 = setToDataModelRecursive(before, SimplePathContainer.create(['existing1', 100]), context, {
      setActions: [{path: SimplePathContainer.create(['test']), params: {model: unknownToDataModel('changed')}}],
    });
    expect(after1).toBeUndefined();

    const after2 = setToDataModelRecursive(before, SimplePathContainer.create(['existing1']), context, {
      setActions: [{path: SimplePathContainer.create([100, 'test']), params: {model: unknownToDataModel('changed')}}],
    });
    expect(after2).toBeUndefined();
  });
});

describe('Unit tests for pushToDataModel', () => {
  it('Can push to list data model', () => {
    const before = unknownToDataModel(['a', 'b']);
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = pushToDataModel(before, undefined, context, {model: unknownToDataModel('c')});
    expect(dataModelToJson(after!)).toEqual(['a', 'b', 'c']);
  });

  it('Can push to nested list data model', () => {
    const before = unknownToDataModel(['a', 'b', {c: 1, d: ['e']}]);
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = pushToDataModel(before, SimplePathContainer.create([2, 'd']), context, {
      model: unknownToDataModel('f'),
    });
    expect(dataModelToJson(after!)).toEqual(['a', 'b', {c: 1, d: ['e', 'f']}]);
  });

  it('Can push to map data model', () => {
    const before = unknownToDataModel({a: 3, b: 7});
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = pushToDataModel(before, undefined, context, {model: unknownToDataModel('c')}) as MapDataModel;
    expect(mapDataSize(after)).toEqual(3);
    expect(dataModelToJson(mapDataLastElement(after)!)).toBe('c');
  });

  it('Can push to nested map data model', () => {
    const before = unknownToDataModel({a: 1, b: ['c', 3, {d: 7}]});
    const context = DataModelContext.createRoot({model: before, schema: undefined});
    const after = pushToDataModel(before, SimplePathContainer.create(['b', 2]), context, {
      model: unknownToDataModel('e'),
    });
    expect(dataModelToJson(getFromDataModel(after!, {components: ['b', 2, 1]})!)).toEqual('e');
  });
});

describe('Unit tests for getFromDataModel', () => {
  it('Can get from map data model', () => {
    const source = unknownToDataModel({a: 7, b: 99});
    const result = getFromDataModel(source, {components: ['b']});
    expect(dataModelToJson(result!)).toBe(99);
  });

  it('Can get from map data model by index', () => {
    const source = unknownToDataModel({a: 7, b: 99});
    const result = getFromDataModel(source, {components: [1]});
    expect(dataModelToJson(result!)).toBe(99);
  });

  it('Cannot get from map data model by invalid key', () => {
    const source = unknownToDataModel({a: 7, b: 99});
    const result = getFromDataModel(source, {components: ['c']});
    expect(result).toBeUndefined();
  });

  it('Can get from list data model', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getFromDataModel(source, {components: [1]});
    expect(dataModelToJson(result!)).toBe('bbbb');
  });

  it('Cannot get from list data model by key', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getFromDataModel(source, {components: ['aaa']});
    expect(result).toBeUndefined();
  });

  it('Cannot get from list data model by invalid index', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getFromDataModel(source, {components: [3]});
    expect(result).toBeUndefined();
  });

  it('Can get from nested data model', () => {
    const source = unknownToDataModel({a: 7, b: [1, 2, {c: 89}]});
    const result = getFromDataModel(source, {components: ['b', 2, 'c']});
    expect(dataModelToJson(result!)).toBe(89);
  });

  it('Can get from nested data model by invalid path', () => {
    const source = unknownToDataModel({a: 7, b: [1, 2, {c: 89}]});
    const result = getFromDataModel(source, {components: ['b', 'c']});
    expect(result).toBeUndefined();
  });
});
