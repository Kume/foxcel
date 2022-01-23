import React, {useRef, useState} from 'react';
import {ReadonlyUIViewProps, UIViewProps} from './UIView';
import {SelectUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import Select from 'react-select';
import {
  getSelectUIOptions,
  selectUIModelDefaultOptions,
  selectUIModelSetValue,
  SelectUIOption,
} from 'co-doc-editor-core/dist/UIModel/SelectUIModel';

interface Props extends UIViewProps {
  readonly model: SelectUIModel;
}

export const SelectUIView: React.FC<Props> = ({model, onAction}) => {
  const [options, setOptions] = useState<SelectUIOption[]>(selectUIModelDefaultOptions(model));
  return (
    <Select<SelectUIOption>
      options={options}
      value={model.current ?? null}
      getOptionValue={(value) => value.value}
      onFocus={() => setOptions(getSelectUIOptions(model))}
      onChange={(value) => onAction(selectUIModelSetValue(model, value))}
    />
  );
};

export const SelectUIViewForTableReadonly: React.FC<ReadonlyUIViewProps<Props>> = ({model}) => {
  return <div>{model.current?.label ?? ''}</div>;
};
