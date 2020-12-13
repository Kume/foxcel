import {
  createRootUiSchemaParsingContext,
  getUiSchemaUniqueKeyOrUndefined,
  parseUISchemaConfig2,
  TabUISchema,
  UISchema,
} from '../UISchema';
import {UISchemaConfig} from '../..';
import {DataSchema, DataSchemaType} from '../../DataModel/DataSchema';
import {mapToObject} from '../../common/utils';

const emptyRootContext = createRootUiSchemaParsingContext(undefined);

type TestData = {readonly uiSchema: UISchema; readonly dataSchema: DataSchema};
type TestDataParam = {readonly key?: string};

const testDataCreator = {
  number: (): TestData => {
    const dataSchema = {t: DataSchemaType.Number} as const;
    const uiSchema = {type: 'number', key: 'test_number', dataSchema} as const;
    return {uiSchema, dataSchema} as const;
  },
  text: (): TestData => {
    const dataSchema = {t: DataSchemaType.String} as const;
    const uiSchema = {type: 'text', key: 'test_text', dataSchema} as const;
    return {uiSchema, dataSchema} as const;
  },
  form: (param: TestDataParam, children: readonly TestData[]): TestData => {
    const dataSchema = {
      t: DataSchemaType.FixedMap,
      items: mapToObject(children, (child) => {
        const key = getUiSchemaUniqueKeyOrUndefined(child.uiSchema);
        return key ? [key, child.dataSchema] : undefined;
      }),
    } as const;
    const uiSchema = {
      type: 'form',
      key: param.key!,
      contents: children.map((child) => child.uiSchema),
      dataSchema,
    } as const;
    return {uiSchema, dataSchema};
  },
  tab: (param: TestDataParam, children: readonly TestData[]): TestData => {
    const dataSchema = {
      t: DataSchemaType.FixedMap,
      items: mapToObject(children, (child) => {
        const key = getUiSchemaUniqueKeyOrUndefined(child.uiSchema);
        return key ? [key, child.dataSchema] : undefined;
      }),
    } as const;
    const uiSchema: TabUISchema = {
      type: 'tab',
      key: param.key!,
      contents: children.map((child) => child.uiSchema),
      dataSchema,
    } as const;
    return {uiSchema, dataSchema};
  },
};

describe('Unit tests for parseUISchemaConfig', () => {
  describe('For text', () => {
    it('DataSchema is empty', () => {
      const result = parseUISchemaConfig2({type: 'text'}, new Map(), emptyRootContext, undefined);
      expect(result.type).toBe('text');
      expect(result.dataSchema).toEqual({t: DataSchemaType.String});
    });
  });

  describe('For number', () => {
    it('DataSchema is empty', () => {
      const result = parseUISchemaConfig2({type: 'number'}, new Map(), emptyRootContext, undefined);
      expect(result.type).toBe('number');
      expect(result.dataSchema).toEqual({t: DataSchemaType.Number});
    });
  });

  describe('For checkbox', () => {
    it('DataSchema is empty', () => {
      const result = parseUISchemaConfig2({type: 'checkbox'}, new Map(), emptyRootContext, undefined);
      expect(result.type).toBe('checkbox');
      expect(result.dataSchema).toEqual({t: DataSchemaType.Boolean});
    });
  });

  describe('For form', () => {
    const configWithKeyFlatten: UISchemaConfig = {
      type: 'form',
      contents: [
        {type: 'text', key: 'test_text'},
        {type: 'form', key: 'test_form', contents: [{type: 'number', key: 'test_number'}]},
      ],
    };
    describe('Without DataSchema', () => {
      it('Simple', () => {
        const uiSchemaConfig: UISchemaConfig = {type: 'form', contents: [{type: 'text', key: 'test_text'}]};
        const result = parseUISchemaConfig2(uiSchemaConfig, new Map(), emptyRootContext, undefined);
        expect(result).toEqual({
          type: 'form',
          contents: [testDataCreator.text().uiSchema],
          dataSchema: {
            t: DataSchemaType.FixedMap,
            items: {test_text: {t: DataSchemaType.String}},
          },
        });
      });

      it('Nested without keyFlatten', () => {
        const result = parseUISchemaConfig2(configWithKeyFlatten, new Map(), emptyRootContext, undefined);
        const expected = testDataCreator.form({}, [
          testDataCreator.text(),
          testDataCreator.form({key: 'test_form'}, [testDataCreator.number()]),
        ]);
        expect(result).toEqual(expected.uiSchema);
        expect(result).toMatchSnapshot();
      });
    });

    describe('With DataSchema', () => {
      it('Nested without keyFlatten', () => {
        const expected = testDataCreator.form({}, [
          testDataCreator.text(),
          testDataCreator.form({key: 'test_form'}, [testDataCreator.number()]),
        ]);
        const result = parseUISchemaConfig2(configWithKeyFlatten, new Map(), emptyRootContext, expected.dataSchema);
        expect(result).toEqual(expected.uiSchema);
        expect(result).toMatchSnapshot();
      });
    });
  });
});
