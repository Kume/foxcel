import {SelectDynamicOptionSchema, SelectOptionSchema, SelectStaticOptionSchema} from './DataSchema';
import {DataModel} from './DataModelTypes';
import {DataModelContext, DataModelContextWithoutSchema} from './DataModelContext';
import {findDataModel} from './DataModelSearcher';
import {dataModelEqualsToUnknown} from './DataModel';

export type SelectOptionGetCurrentResult<SelectValue> =
  | {
      readonly t: 'static';
      readonly option: SelectStaticOptionSchema<SelectValue>;
      readonly label: string;
      readonly data: DataModel;
    }
  | {
      readonly t: 'dynamic';
      readonly option: SelectDynamicOptionSchema;
      readonly data: DataModel;
      readonly context: DataModelContextWithoutSchema;
    };

export function selectOptionGetCurrent<SelectValue>(
  options: readonly SelectOptionSchema<SelectValue>[],
  currentValue: DataModel,
  context: DataModelContext,
): SelectOptionGetCurrentResult<SelectValue> | undefined {
  for (const option of options) {
    if (option.label === undefined) {
      // Dynamic option
      const findResult = findDataModel(
        // TODO matcherは暫定対応なので、後でちゃんと実装する
        {path: option.path, matcher: {type: 'equal', operand1: option.valuePath, operand2: currentValue}},
        context.toWithoutSchema(),
      );
      if (findResult) {
        return {t: 'dynamic', option, ...findResult};
      }
    } else {
      // Static option
      if (dataModelEqualsToUnknown(currentValue, option.value)) {
        return {t: 'static', option, label: option.label, data: currentValue};
      }
    }
  }
  return undefined;
}
