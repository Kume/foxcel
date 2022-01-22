import React from 'react';
import {UIViewProps} from './UIView';
import {SelectUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import AsyncSelect from 'react-select/async';

interface Props extends UIViewProps {
  readonly model: SelectUIModel;
}

export const SelectUIView: React.FC<Props> = ({model, onAction}) => {
  return <AsyncSelect defaultOptions={model.current ? [model.current] : []} />;
};
