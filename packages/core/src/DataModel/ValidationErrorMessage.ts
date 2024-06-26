export type ValidationErrorMessageKey =
  | 'required'
  | 'map_key_is_null'
  | 'map_key_is_duplicated'
  | 'invalid_data_type'
  | 'invalid_option'
  | 'is_not_nullable'
  | 'minus_number_is_not_arrowed'
  | 'number_must_be_integer'
  | 'is_less_than_minimum'
  | 'is_greater_than_maximum'
  | 'is_not_alpha_num'
  | 'is_not_alpha_num_hyphen'
  | 'is_not_alpha_num_underscore'
  | 'is_not_snake_case'
  | 'is_not_camel_case'
  | 'is_not_pascal_case'
  | 'is_not_kebab_case'
  | 'is_not_upper_snake_case'
  | 'is_not_safe_identifier'
  | 'mapping_source_is_invalid_data_type'
  | 'mapping_source_key_does_not_exist';
