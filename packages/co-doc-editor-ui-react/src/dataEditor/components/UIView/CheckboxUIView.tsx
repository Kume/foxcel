import React from 'react';
import {UIViewProps} from './UIView';
import {CheckboxUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {checkboxUIModelValue, selectUIModelSetValue} from 'co-doc-editor-core/dist/UIModel/CheckboxUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';

interface Props extends UIViewProps {
  readonly model: CheckboxUIModel;
}

export const CheckboxUIView: React.FC<Props> = ({model, onAction}) => {
  return (
    <input
      type="checkbox"
      checked={checkboxUIModelValue(model)}
      onChange={(e) => onAction(selectUIModelSetValue(e.target.checked, model))}
    />
  );
};

interface PropsForTableCell extends TableUIViewCellProps {
  readonly model: CheckboxUIModel;
}

const LayoutRootForTableCell = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LabelForTableCell = styled.div`
  margin: 0 0.5em;
`;

export const CheckboxUIViewForTableCell: React.FC<PropsForTableCell> = ({model, row, col, callbacks}) => {
  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
    >
      <LabelForTableCell onMouseDown={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checkboxUIModelValue(model)}
          onChange={(e) => callbacks.onAction(selectUIModelSetValue(e.target.checked, model))}
        />
      </LabelForTableCell>
    </LayoutRootForTableCell>
  );
};
