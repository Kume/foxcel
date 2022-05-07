import {
  BooleanDataModel,
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
  dataModelToJson,
  getFromDataModel,
  mapDataLastElement,
  mapDataSize,
  pushToDataModel,
  setToDataModel,
  unknownToDataModel,
} from '../DataModel';

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
    expect(Array.isArray(dataModel)).toBeTruthy();
    expect(dataModel[0]).toBe(1);
    expect(dataModel[1]).toBe('b');
    expect(dataModel[2]).toBe(null);
  });

  it('To MapDataModel', () => {
    const dataModel = unknownToDataModel({a: 1, c: null, b: 'test'}) as MapDataModel;
    expect(dataModel.t).toBe(DataModelType.Map);
    expect(dataModel.v[0][0]).toBe('a');
    expect(dataModel.v[0][1]).toBe(1);
    expect(dataModel.v[1][0]).toBe('c');
    expect(dataModel.v[1][1]).toBe(null);
    expect(dataModel.v[2][0]).toBe('b');
    expect(dataModel.v[2][1]).toBe('test');
  });

  it('To Nested', () => {
    const dataModel = unknownToDataModel({a: 1, c: ['b', {c: null}]}) as MapDataModel;
    expect(dataModel.t).toBe(DataModelType.Map);
    const listDataModel = dataModel.v[1][1] as ListDataModel;
    expect(Array.isArray(listDataModel)).toBeTruthy();
    const childMapDataModel = listDataModel[1] as MapDataModel;
    expect(childMapDataModel.v[0][1]).toBe(null);
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
    model = pushToDataModel({components: []}, unknownToDataModel('c'), model) as MapDataModel;
    const result = dataModelEqualsToUnknown(model, {a: 1, b: 3});
    expect(result).toBe(true);
  });
});

describe('Unit tests for setToDataModel', () => {
  it('Can set to scalar data model', () => {
    const before = unknownToDataModel(1);
    const after = setToDataModel({components: []}, unknownToDataModel('test'), before);
    expect(dataModelToJson(after!)).toBe('test');
  });

  it('Can set to list data model', () => {
    const before = unknownToDataModel(['a', 'b']);
    const after = setToDataModel({components: [1]}, unknownToDataModel('c'), before)!;
    expect(before).not.toBe(after);
    expect(dataModelToJson(before)).toEqual(['a', 'b']); // is immutable
    expect(dataModelToJson(after)).toEqual(['a', 'c']);
  });

  it('Can set to nested list data model', () => {
    const before = unknownToDataModel(['a', {b: [null, 'c']}]) as ListDataModel;
    const after = setToDataModel({components: [1, 'b', 1]}, unknownToDataModel('d'), before) as ListDataModel;
    expect(before[1]).not.toBe(after[1]);
    expect(dataModelToJson(before)).toEqual(['a', {b: [null, 'c']}]); // is immutable
    expect(dataModelToJson(after)).toEqual(['a', {b: [null, 'd']}]);
  });

  it('Can set to map data model', () => {
    const before = unknownToDataModel({a: 1, b: 'c'});
    const after = setToDataModel({components: ['b']}, unknownToDataModel('d'), before)!;
    expect(before).not.toBe(after);
    expect(dataModelToJson(before)).toEqual({a: 1, b: 'c'}); // is immutable
    expect(dataModelToJson(after)).toEqual({a: 1, b: 'd'});
  });

  it('Can set to map data model by index', () => {
    const before = unknownToDataModel({a: 1, b: 'c'});
    const after = setToDataModel({components: [1]}, unknownToDataModel('d'), before)!;
    expect(before).not.toBe(after);
    expect(dataModelToJson(after)).toEqual({a: 1, b: 'd'});
  });

  it('Can set to nested map data model', () => {
    const before = unknownToDataModel({a: 1, b: [null, {c: 'd'}]}) as MapDataModel;
    const after = setToDataModel({components: ['b', 1, 'c']}, unknownToDataModel('e'), before) as MapDataModel;
    expect(before.v[1][1]).not.toBe(after.v[1][1]);
    expect(dataModelToJson(before)).toEqual({a: 1, b: [null, {c: 'd'}]}); // is immutable
    expect(dataModelToJson(after)).toEqual({a: 1, b: [null, {c: 'e'}]});
  });
});

describe('Unit tests for pushToDataModel', () => {
  it('Can push to list data model', () => {
    const before = unknownToDataModel(['a', 'b']);
    const after = pushToDataModel({components: []}, unknownToDataModel('c'), before);
    expect(dataModelToJson(after!)).toEqual(['a', 'b', 'c']);
  });

  it('Can push to nested list data model', () => {
    const before = unknownToDataModel(['a', 'b', {c: 1, d: ['e']}]);
    const after = pushToDataModel({components: [2, 'd']}, unknownToDataModel('f'), before);
    expect(dataModelToJson(after!)).toEqual(['a', 'b', {c: 1, d: ['e', 'f']}]);
  });

  it('Can push to map data model', () => {
    const before = unknownToDataModel({a: 3, b: 7});
    const after = pushToDataModel({components: []}, unknownToDataModel('c'), before) as MapDataModel;
    expect(mapDataSize(after)).toEqual(3);
    expect(dataModelToJson(mapDataLastElement(after)!)).toBe('c');
  });

  it('Can push to nested map data model', () => {
    const before = unknownToDataModel({a: 1, b: ['c', 3, {d: 7}]});
    const after = pushToDataModel({components: ['b', 2]}, unknownToDataModel('e'), before);
    expect(dataModelToJson(getFromDataModel(after!, {components: ['b', 2, 1]})!)).toEqual('e');
  });

  it('Can push to nested map data model by index', () => {
    const before = unknownToDataModel({a: 1, b: ['c', 3, {d: 7}]});
    const after = pushToDataModel({components: [1, 2]}, unknownToDataModel('e'), before);
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
