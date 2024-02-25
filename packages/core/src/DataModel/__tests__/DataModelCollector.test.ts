import {dataModelToJson, unknownToDataModel} from '../DataModel';
import {getDataModelByForwardPath} from '../DataModelCollector';

describe('Unit tests for getDataModelByForwardPath', () => {
  it('Can get from map data model', () => {
    const source = unknownToDataModel({a: 7, b: 99});
    const result = getDataModelByForwardPath(source, {components: ['b']});
    expect(dataModelToJson(result!)).toBe(99);
  });

  it('Cannot get from map data model by invalid key', () => {
    const source = unknownToDataModel({a: 7, b: 99});
    const result = getDataModelByForwardPath(source, {components: ['c']});
    expect(result).toBeUndefined();
  });

  it('Can get from list data model', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getDataModelByForwardPath(source, {components: [1]});
    expect(dataModelToJson(result!)).toBe('bbbb');
  });

  it('Cannot get from list data model by key', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getDataModelByForwardPath(source, {components: ['aaa']});
    expect(result).toBeUndefined();
  });

  it('Cannot get from list data model by invalid index', () => {
    const source = unknownToDataModel(['aaa', 'bbbb']);
    const result = getDataModelByForwardPath(source, {components: [3]});
    expect(result).toBeUndefined();
  });

  it('Can get from nested data model', () => {
    const source = unknownToDataModel({a: 7, b: [1, 2, {c: 89}]});
    const result = getDataModelByForwardPath(source, {components: ['b', 2, 'c']});
    expect(dataModelToJson(result!)).toBe(89);
  });

  it('Can get from nested data model by invalid path', () => {
    const source = unknownToDataModel({a: 7, b: [1, 2, {c: 89}]});
    const result = getDataModelByForwardPath(source, {components: ['b', 'c']});
    expect(result).toBeUndefined();
  });
});
