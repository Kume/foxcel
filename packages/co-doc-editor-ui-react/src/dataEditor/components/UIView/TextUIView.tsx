import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React, {useCallback, useEffect, useState} from 'react';
import {UIViewProps} from './UIView';
import {textUIModelSetText} from 'co-doc-editor-core/dist/UIModel/TextUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {TextWithBreak} from '../../../common/TextWithBreak';

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
`;

const TextareaLayout = styled.div<{readonly isVisible: boolean}>``;

const TextareaForTableCell = styled.textarea<{readonly isVisible: boolean}>`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  position: absolute;
  opacity: ${({isVisible}) => (isVisible ? 1 : 0)};

  background-color: transparent;
  font-size: var(--basic-font-size);
  font-family: meiryo;

  border: none;
  &:focus {
    outline: none;
  }
`;

export const TextUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingText, setEditingText] = useState<string | null>(model.value);
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
    }
  }, [isMainSelected]);
  useEffect(() => {
    setEditingText(model.value);
  }, [model.value]);

  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onDoubleClick={() => setIsEditing(true)}>
      <TextWithBreak text={editingText ?? ''} />
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
