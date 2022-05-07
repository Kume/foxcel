import {NamedUISchemaManager} from '../UISchema';
import {focusForUIModel} from '../UIModelFocus';
import {NestedNamedItem} from '../../common/NestedNamedItem';
import {UISchema} from '../UISchemaTypes';

const schema: UISchema = {
  type: 'tab',
  contents: [
    {
      type: 'tab',
      // key: 'tab1',
      keyFlatten: true,
      flatKeys: {},
      contents: [
        {
          type: 'text',
          key: 'tab1_1',
        },
        {
          type: 'tab',
          // key: 'tab1_2',
          keyFlatten: true,
          contents: [
            {
              type: 'text',
              key: 'tab1_2_a',
            },
            {
              type: 'text',
              key: 'tab1_2_b',
            },
          ],
        },
        {
          type: 'text',
          key: 'tab1_3',
        },
      ],
    },
    {
      type: 'text',
      key: 'tab2',
    },
  ],
};

const emptyUiManager = new NamedUISchemaManager(new NestedNamedItem());

describe('Unit tests for focusForUIModel', () => {
  it('Focus empty path', () => {
    const result = focusForUIModel({}, {components: []}, 'test', schema, emptyUiManager);
    expect(result).toEqual({});
  });

  it('Select simple tab', () => {
    const result = focusForUIModel({}, {components: ['tab2']}, 'test', schema, emptyUiManager);
    expect(result).toEqual({active: 1 /* tab2 */});
  });

  it('Select nested tab', () => {
    const result = focusForUIModel({}, {components: ['tab1_3']}, 'test', schema, emptyUiManager);
    expect(result).toEqual({active: 0 /* tab1 */, children: new Map([[0 /* tab1 */, {active: 2 /* tab1_3 */}]])});
  });

  it('Select deep nested tab', () => {
    const result = focusForUIModel({}, {components: ['tab1_2_b']}, 'test', schema, emptyUiManager);
    expect(result).toEqual({
      active: 0 /* tab1 */,
      children: new Map([
        [0 /* tab1 */, {active: 1 /* tab1_2 */, children: new Map([[1 /* tab1_2 */, {active: 1 /* tab1_2_b */}]])}],
      ]),
    });
  });
});
