import React from 'react';
import {UIViewProps} from './UIView';
import {CheckboxUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {checkboxUIModelValue, checkboxUIModelSetValue} from 'co-doc-editor-core/dist/UIModel/CheckboxUIModel';
import {ModelOrSchemaHolder, TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {CheckBoxUISchema} from 'co-doc-editor-core/dist/UIModel/UISchemaTypes';
import {trueDataModel} from 'co-doc-editor-core';

interface Props extends UIViewProps {
  readonly model: CheckboxUIModel;
}

export const CheckboxUIView: React.FC<Props> = ({model, onAction}) => {
  return (
    <input
      type="checkbox"
      checked={checkboxUIModelValue(model)}
      onChange={(e) => onAction(checkboxUIModelSetValue(e.target.checked, model))}
    />
  );
};

type PropsForTableCell = TableUIViewCellProps & ModelOrSchemaHolder<CheckboxUIModel, CheckBoxUISchema>;

const LayoutRootForTableCell = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LabelForTableCell = styled.div`
  margin: 0 0.5em;
`;

export const CheckboxUIViewForTableCell: React.FC<PropsForTableCell> = ({model, schema, row, col, callbacks}) => {
  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
    >
      <LabelForTableCell onMouseDown={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={model ? checkboxUIModelValue(model) : false}
          onChange={(e) => {
            if (model) {
              callbacks.onAction(checkboxUIModelSetValue(e.target.checked, model));
            } else if (schema) {
              schema.onEdit(trueDataModel);
            }
          }}
        />
      </LabelForTableCell>
    </LayoutRootForTableCell>
  );
};
