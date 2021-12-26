import React from 'react';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {FormUIView} from './FormUIView';
import {TextUIView} from './TextUIView';
import {DataModelAction} from 'co-doc-editor-core/dist/DataModel/DataModelAction';
import {TabUIView} from './TabUIView';
import {ForwardDataPath} from 'co-doc-editor-core';

export interface UIViewProps {
  readonly model: UIModel;
  onChangeData(action: DataModelAction): void;
  onFocusByDataPath(dataPath: ForwardDataPath): void;
}

export const UIView: React.FC<UIViewProps> = ({model, ...others}) => {
  switch (model.type) {
    case 'form':
      return <FormUIView model={model} {...others} />;

    case 'text':
      return <TextUIView model={model} {...others} />;

    case 'tab':
      return <TabUIView model={model} {...others} />;

    default:
      return <div>Error</div>;
  }
};
