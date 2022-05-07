import React, {useEffect, useRef} from 'react';
import {UIViewProps} from './UIView';
import {CheckboxUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {checkboxUIModelValue, checkboxUIModelSetValue} from 'co-doc-editor-core/dist/UIModel/CheckboxUIModel';
import {ModelOrSchemaHolder, TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {CheckBoxUISchema} from 'co-doc-editor-core/dist/UIModel/UISchemaTypes';
import {trueDataModel} from 'co-doc-editor-core';
import {withoutModifierKey} from '../../../common/Keybord';

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

export const CheckboxUIViewForTableCell: React.FC<PropsForTableCell> = ({
  model,
  schema,
  isMainSelected,
  row,
  col,
  callbacks,
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isMainSelected) {
      checkboxRef.current?.focus();
    }
  }, [isMainSelected]);
  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
    >
      <LabelForTableCell onMouseDown={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          ref={checkboxRef}
          checked={model ? checkboxUIModelValue(model) : false}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (!callbacks.onKeyDown(e, false)) {
              if (e.key === 'Space' && withoutModifierKey(e)) {
                if (model) {
                  callbacks.onAction(checkboxUIModelSetValue(!checkboxRef.current?.checked, model));
                } else if (schema) {
                  schema.onEdit(trueDataModel);
                }
              }
            }
          }}
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
