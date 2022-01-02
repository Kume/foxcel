import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React from 'react';
import {UIViewProps} from './UIView';
import {textUIModelSetText} from 'co-doc-editor-core/dist/UIModel/TextUIModel';

export interface TextUIViewProps extends UIViewProps {
  readonly model: TextUIModel;
}

export const TextUIView: React.FC<TextUIViewProps> = ({model, onAction}) => {
  return <input value={model.value ?? ''} onChange={(e) => onAction(textUIModelSetText(model, e.target.value))} />;
};
