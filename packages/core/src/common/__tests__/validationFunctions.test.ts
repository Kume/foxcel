import {
  isAlphaNumHyphen,
  isAlphaNumUnderscore,
  isCamelCase,
  isKebabCase,
  isPascalCase,
  isSafeIdentifier,
  isSnakeCase,
  isUpperSnakeCase,
} from '../validationFunctions';

it('Test for isAlphaNumUnderscore', () => {
  expect(isAlphaNumUnderscore('abc')).toBeTruthy();
  expect(isAlphaNumUnderscore('Abc')).toBeTruthy();
  expect(isAlphaNumUnderscore('01_abCd')).toBeTruthy();

  expect(isAlphaNumUnderscore('abc d')).toBeFalsy();
  expect(isAlphaNumUnderscore('abc ')).toBeFalsy();
  expect(isAlphaNumUnderscore(' abc')).toBeFalsy();
  expect(isAlphaNumUnderscore('ab-c')).toBeFalsy();
  expect(isAlphaNumUnderscore('abあc')).toBeFalsy();
});

it('Test for isAlphaNumHyphen', () => {
  expect(isAlphaNumHyphen('abc')).toBeTruthy();
  expect(isAlphaNumHyphen('Abc')).toBeTruthy();
  expect(isAlphaNumHyphen('01-abCd')).toBeTruthy();

  expect(isAlphaNumHyphen('abc d')).toBeFalsy();
  expect(isAlphaNumHyphen('abc ')).toBeFalsy();
  expect(isAlphaNumHyphen(' abc')).toBeFalsy();
  expect(isAlphaNumHyphen('ab_c')).toBeFalsy();
  expect(isAlphaNumHyphen('abあc')).toBeFalsy();
});

it('Test for isCamelCase', () => {
  expect(isCamelCase('value')).toBeTruthy();
  expect(isCamelCase('someValue')).toBeTruthy();
  expect(isCamelCase('someValue01')).toBeTruthy();
  expect(isCamelCase('some01Value')).toBeTruthy();

  expect(isCamelCase('PascalCase')).toBeFalsy();
  expect(isCamelCase('Train-Case')).toBeFalsy();
  expect(isCamelCase('snake_case')).toBeFalsy();
  expect(isCamelCase('kebab-case')).toBeFalsy();
  expect(isCamelCase('UPPER_SNAKE_CASE')).toBeFalsy();
});

it('Test for isPascalCase', () => {
  expect(isPascalCase('Value')).toBeTruthy();
  expect(isPascalCase('SomeValue')).toBeTruthy();
  expect(isPascalCase('SomeValue01')).toBeTruthy();
  expect(isPascalCase('Some01Value')).toBeTruthy();

  expect(isPascalCase('camelCase')).toBeFalsy();
  expect(isPascalCase('Train-Case')).toBeFalsy();
  expect(isPascalCase('snake_case')).toBeFalsy();
  expect(isPascalCase('kebab-case')).toBeFalsy();
  expect(isPascalCase('UPPER_SNAKE_CASE')).toBeFalsy();
});

it('Test for isKebabCase', () => {
  expect(isKebabCase('value')).toBeTruthy();
  expect(isKebabCase('some-value')).toBeTruthy();
  expect(isKebabCase('some-value01')).toBeTruthy();
  expect(isKebabCase('some01-value')).toBeTruthy();

  expect(isKebabCase('PascalCase')).toBeFalsy();
  expect(isKebabCase('camelCase')).toBeFalsy();
  expect(isKebabCase('Train-Case')).toBeFalsy();
  expect(isKebabCase('snake_case')).toBeFalsy();
  expect(isKebabCase('UPPER_SNAKE_CASE')).toBeFalsy();
});

it('Test for isSnakeCase', () => {
  expect(isSnakeCase('value')).toBeTruthy();
  expect(isSnakeCase('some_value')).toBeTruthy();
  expect(isSnakeCase('some_value01')).toBeTruthy();
  expect(isSnakeCase('some01_value')).toBeTruthy();

  expect(isSnakeCase('PascalCase')).toBeFalsy();
  expect(isSnakeCase('camelCase')).toBeFalsy();
  expect(isSnakeCase('Train-Case')).toBeFalsy();
  expect(isSnakeCase('kebab-case')).toBeFalsy();
  expect(isSnakeCase('UPPER_SNAKE_CASE')).toBeFalsy();
});

it('Test for isUpperSnakeCase', () => {
  expect(isUpperSnakeCase('VALUE')).toBeTruthy();
  expect(isUpperSnakeCase('SOME_VALUE')).toBeTruthy();
  expect(isUpperSnakeCase('SOME_VALUE01')).toBeTruthy();
  expect(isUpperSnakeCase('SOME01_VALUE')).toBeTruthy();

  expect(isUpperSnakeCase('PascalCase')).toBeFalsy();
  expect(isUpperSnakeCase('camelCase')).toBeFalsy();
  expect(isUpperSnakeCase('Train-Case')).toBeFalsy();
  expect(isUpperSnakeCase('kebab-case')).toBeFalsy();
  expect(isUpperSnakeCase('snake_case')).toBeFalsy();
});

it('Test for isSafeIdentifier', () => {
  expect(isSafeIdentifier('value')).toBeTruthy();
  expect(isSafeIdentifier('a')).toBeTruthy();
  expect(isSafeIdentifier('PascalCase')).toBeTruthy();
  expect(isSafeIdentifier('CamelCase')).toBeTruthy();
  expect(isSafeIdentifier('snake_case')).toBeTruthy();
  expect(isSafeIdentifier('_starts_with_underscore')).toBeTruthy();
  expect(isSafeIdentifier('has01number')).toBeTruthy();

  expect(isSafeIdentifier('kebab-case')).toBeFalsy();
  expect(isSafeIdentifier('1starts_with_number')).toBeFalsy();
  expect(isSafeIdentifier('')).toBeFalsy();
  expect(isSafeIdentifier('1')).toBeFalsy();
  expect(isSafeIdentifier(' contains_space')).toBeFalsy();
  expect(isSafeIdentifier('contains space')).toBeFalsy();
  expect(isSafeIdentifier('contains_space ')).toBeFalsy();
  expect(isSafeIdentifier('contains_ひらがな')).toBeFalsy();
});
