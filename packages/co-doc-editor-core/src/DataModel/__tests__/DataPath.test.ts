import {dataPathLastComponent, keySymbol, popDataPath, shiftDataPath} from '../DataPath';

describe('Unit tests for DataPath', () => {
  describe('Unit tests for popDataPath', () => {
    it('Can pop array data path', () => {
      const result = popDataPath({components: ['a', 7, 'c']});
      expect(result).toEqual({components: ['a', 7]});
    });
  });

  describe('Unit tests for shiftDataPath', () => {
    it('Can pop', () => {
      const result = shiftDataPath({components: ['a', 7, 'c']});
      expect(result).toEqual({components: [7, 'c']});
    });

    it('should remove isAbsolute', () => {
      const result = shiftDataPath({components: ['a', 7, 'c'], isAbsolute: true});
      expect(result).toEqual({components: [7, 'c']});
    });

    it('can shift path that points key', () => {
      const result = shiftDataPath({components: ['a', 7, 'c', keySymbol]});
      expect(result).toEqual({components: [7, 'c', keySymbol], pointsKey: true});
    });
  });

  describe('Unit tests for dataPathLastElement', () => {
    it('Can get last element', () => {
      expect(dataPathLastComponent({components: ['a', 6, 'd']})).toBe('d');
    });
  });
});
