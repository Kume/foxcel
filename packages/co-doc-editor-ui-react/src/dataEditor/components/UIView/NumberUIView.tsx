import {UIViewProps} from './UIView';
import React, {useEffect, useRef, useState} from 'react';
import {NumberUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {numberDataModelToNumber} from 'co-doc-editor-core';
import {numberUIModelDisplayText, numberUIModelSetText} from 'co-doc-editor-core/dist/UIModel/NumberUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {TextareaForTableCell} from './TableUIViewCellCommon';
import styled from 'styled-components';

interface Props extends UIViewProps {
  readonly model: NumberUIModel;
}

export const NumberUIView: React.FC<Props> = ({model, onAction}) => {
  const [editingText, setEditingText] = useState<string>(numberUIModelDisplayText(model));
  useEffect(() => {
    setEditingText(numberUIModelDisplayText(model));
  }, [model]);
  return (
    <input
      value={editingText}
      onChange={(e) => setEditingText(e.target.value)}
      onBlur={() => {
        const action = numberUIModelSetText(model, editingText);
        if (action) onAction(action);
      }}
    />
  );
};

interface PropsForTableCell extends TableUIViewCellProps {
  readonly model: NumberUIModel;
}

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

export const NumberUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const modelValue = model.data === undefined ? undefined : numberDataModelToNumber(model.data);
  const [editingText, setEditingText] = useState<string>(modelValue === undefined ? '' : modelValue.toString());

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditingText(numberUIModelDisplayText(model));
  }, [model]);

  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onMouseUp={() => textAreaRef.current?.focus()}
      onDoubleClick={() => setIsEditing(true)}
    >
      <TextWithBreak text={editingText ?? ''} />
      {isMainSelected && (
        <TextareaForTableCell
          isVisible={isEditing}
          ref={textAreaRef}
          onChange={change}
          onBlur={blur}
          value={(isEditing && editingText) || ''}
        />
      )}
    </LayoutRootForTableCell>
  );
};
