import {resolvePath} from '../utils';

describe('Unit tests for resolvePath', () => {
  it('Can resolve', () => {
    const result = resolvePath([], ['a', 'b', 'c', '..', '..', 'd']);
    expect(result).toEqual(['a', 'd']);
  });
});
