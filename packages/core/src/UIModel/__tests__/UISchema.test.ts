import {
  buildUISchema,
  createRootUiSchemaParsingContext,
  getUiSchemaUniqueKeyOrUndefined,
  parseUISchemaConfig,
} from '../UISchema';
import {UISchemaConfig} from '../..';
import {buildDataSchema, DataSchema, DataSchemaType} from '../../DataModel/DataSchema';
import {mapToObject} from '../../common/utils';
import {TabUISchema, UISchemaOrRecursive} from '../UISchemaTypes';
import {ObjectDataStorage} from '../../Storage/ObjectDataStorage';
import {YamlDataFormatter} from '../../Storage/YamlDataFormatter';
import {configFixtures} from '../../common/testFixtures';

const emptyRootContext = createRootUiSchemaParsingContext(undefined);

type TestData = {readonly uiSchema: UISchemaOrRecursive; readonly dataSchema: DataSchema};
type TestDataParam = {readonly key?: string};

const testDataCreator = {
  number: (): TestData => {
    const dataSchema = {
      t: DataSchemaType.Number,
      numberType: 'unsignedInteger',
      required: false,
      max: undefined,
      min: undefined,
    } as const;
    const uiSchema = {type: 'number', key: 'test_number', dataSchema} as const;
    return {uiSchema, dataSchema} as const;
  },
  text: (): TestData => {
    const dataSchema = {t: DataSchemaType.String, required: false} as const;
    const uiSchema = {type: 'text', key: 'test_text', dataSchema, multiline: undefined} as const;
    return {uiSchema, dataSchema} as const;
  },
  form: (param: TestDataParam, children: readonly TestData[]): TestData => {
    const dataSchema = {
      t: DataSchemaType.FixedMap,
      required: false,
      contextKey: undefined,
      pathAliases: undefined,
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
      required: false,
      contextKey: undefined,
      pathAliases: undefined,
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
      const result = parseUISchemaConfig({type: 'text'}, new Map(), emptyRootContext, undefined);
      expect(result.type).toBe('text');
      expect(result.dataSchema).toEqual({t: DataSchemaType.String});
    });
  });

  describe('For number', () => {
    it('DataSchema is empty', () => {
      const result = parseUISchemaConfig({type: 'number'}, new Map(), emptyRootContext, undefined);
      expect(result.type).toBe('number');
      expect(result.dataSchema).toEqual({t: DataSchemaType.Number});
    });
  });

  describe('For checkbox', () => {
    it('DataSchema is empty', () => {
      const result = parseUISchemaConfig({type: 'checkbox'}, new Map(), emptyRootContext, undefined);
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
        const result = parseUISchemaConfig(uiSchemaConfig, new Map(), emptyRootContext, undefined);
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
        const result = parseUISchemaConfig(configWithKeyFlatten, new Map(), emptyRootContext, undefined);
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
        const result = parseUISchemaConfig(configWithKeyFlatten, new Map(), emptyRootContext, expected.dataSchema);
        expect(result).toEqual(expected.uiSchema);
        expect(result).toMatchSnapshot();
      });
    });
  });
});

describe('Unit tests for buildUISchema', () => {
  it('Recursive', async () => {
    const storage = new ObjectDataStorage();
    const fixture = configFixtures.simpleRecursive;
    const dataSchema = await buildDataSchema(fixture.schema, storage, new YamlDataFormatter());
    const uiSchema = await buildUISchema(fixture.schema, dataSchema, storage, new YamlDataFormatter());
    // TODO expect書く
    console.log(uiSchema);
  });
});
