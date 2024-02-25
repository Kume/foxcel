import React from 'react';
import {AppAction, DataModelRoot, UIModel} from '@foxcel/core';
import {FormUIView} from './FormUIView';
import {TextUIView} from './TextUIView';
import {TabUIView} from './TabUIView';
import {ContentListUIView} from './ContentListUIView';
import {TableUIView} from './TableUIView';
import {SelectUIView} from './SelectUIView';
import {CheckboxUIView} from './CheckboxUIView';
import {NumberUIView} from './NumberUIView';
import {MappingTableUIView} from './MappingTableUIView';

export interface UIViewProps {
  readonly model: UIModel;
  onAction(action: AppAction | undefined): void;
  getRoot(): DataModelRoot;
}

export const UIView: React.FC<UIViewProps> = ({model, ...others}) => {
  switch (model.type) {
    case 'form':
      return <FormUIView model={model} {...others} />;

    case 'text':
      return <TextUIView model={model} {...others} />;

    case 'number':
      return <NumberUIView model={model} {...others} />;

    case 'tab':
      return <TabUIView model={model} {...others} />;

    case 'contentList':
      return <ContentListUIView model={model} {...others} />;

    case 'table':
      return <TableUIView model={model} {...others} />;

    case 'mappingTable':
      return <MappingTableUIView model={model} {...others} />;

    case 'select':
      return <SelectUIView model={model} {...others} />;

    case 'checkbox':
      return <CheckboxUIView model={model} {...others} />;

    default:
      return <div>Error</div>;
  }
};
