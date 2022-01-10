import React from 'react';
import {UIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';

interface Props {
  readonly model: UIModel;
}

export const ReadOnlyUIView: React.FC<Props> = ({model}) => {
  switch (model.type) {
    case 'text':
      return <div>{model.value}</div>;

    default:
      return <div>Error</div>;
  }
};
