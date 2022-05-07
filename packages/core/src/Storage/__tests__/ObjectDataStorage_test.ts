import ObjectDataStorage from '../ObjectDataStorage';

describe('Test for saveAsync', () => {
  it('Save with single path', async () => {
    const storage = new ObjectDataStorage();
    await storage.saveAsync(['testPath'], 'test_content');
    expect(storage.data).toEqual({testPath: 'test_content'});
  });
});
