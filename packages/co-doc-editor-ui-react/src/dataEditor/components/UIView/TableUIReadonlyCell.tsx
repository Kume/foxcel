import React from 'react';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {TextUIViewForTableReadonlyCell} from './TextUIView';
import {SelectUIViewForTableReadonly} from './SelectUIView';

interface Props {
  readonly model: UIModel;
}

export const TableUIReadonlyCell: React.FC<Props> = ({model}) => {
  switch (model.type) {
    case 'text':
      return <TextUIViewForTableReadonlyCell model={model} />;

    case 'select':
      return <SelectUIViewForTableReadonly model={model} />;

    default:
      return <div>Error</div>;
  }
};
