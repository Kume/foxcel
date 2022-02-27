import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {textUIModelSetText} from 'co-doc-editor-core/dist/UIModel/TextUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {TextareaForTableCell} from './TableUIViewCellCommon';

export interface TextUIViewProps extends UIViewProps {
  readonly model: TextUIModel;
}

export const TextUIView: React.FC<TextUIViewProps> = ({model, onAction}) => {
  return <input value={model.value ?? ''} onChange={(e) => onAction(textUIModelSetText(model, e.target.value))} />;
};

interface PropsForTableCell extends TableUIViewCellProps {
  readonly model: TextUIModel;
}

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

export const TextUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingText, setEditingText] = useState<string | null>(model.value);
  const editingTextRef = useRef(editingText);
  editingTextRef.current = editingText;
  const change = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingText(e.target.value);
    setIsEditing(true);
  }, []);
  const blur = useCallback(() => {
    callbacks.onAction(textUIModelSetText(model, editingText));
  }, [callbacks, editingText, model]);

  useEffect(() => {
    if (!isMainSelected) {
      setIsEditing(false);
      if (model.value !== editingTextRef.current) {
        callbacks.onAction(textUIModelSetText(model, editingTextRef.current));
      }
    }
  }, [callbacks, isMainSelected, model]);
  useEffect(() => {
    setEditingText(model.value);
  }, [model.value]);

  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onDoubleClick={() => setIsEditing(true)}>
      <TextWithBreak key="a" text={editingText ?? ''} />
      {isMainSelected && (
        <TextareaForTableCell
          isVisible={isEditing}
          ref={(ref) => ref?.focus()}
          onChange={change}
          onBlur={blur}
          value={(isEditing && editingText) || ''}
        />
      )}
    </LayoutRootForTableCell>
  );
};
