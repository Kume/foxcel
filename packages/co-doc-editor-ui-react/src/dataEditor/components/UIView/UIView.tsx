import React from 'react';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {FormUIView} from './FormUIView';
import {TextUIView} from './TextUIView';
import {TabUIView} from './TabUIView';
import {ContentListUIView} from './ContentListUIView';
import {AppAction} from 'co-doc-editor-core/dist/App/AppState';
import {TableUIView} from './TableUIView';
import {SelectUIView} from './SelectUIView';

export interface UIViewProps {
  readonly model: UIModel;
  onAction(action: AppAction): void;
}

export const UIView: React.FC<UIViewProps> = ({model, ...others}) => {
  switch (model.type) {
    case 'form':
      return <FormUIView model={model} {...others} />;

    case 'text':
      return <TextUIView model={model} {...others} />;

    case 'tab':
      return <TabUIView model={model} {...others} />;

    case 'contentList':
      return <ContentListUIView model={model} {...others} />;

    case 'table':
      return <TableUIView model={model} {...others} />;

    case 'select':
      return <SelectUIView model={model} {...others} />;

    default:
      return <div>Error</div>;
  }
};
