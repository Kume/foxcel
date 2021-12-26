import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React from 'react';
import {UIViewProps} from './UIView';
import {stringToDataModel} from 'co-doc-editor-core';

export interface TextUIViewProps extends UIViewProps {
  readonly model: TextUIModel;
}

export const TextUIView: React.FC<TextUIViewProps> = ({model, onChangeData}) => {
  return (
    <input
      value={model.value}
      onChange={(e) => onChangeData({type: 'set', path: model.dataPath, data: stringToDataModel(e.target.value)})}
    />
  );
};
