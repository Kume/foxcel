import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React, {useCallback, useRef} from 'react';
import {UIViewProps} from './UIView';
import {textUIModelSetText} from 'co-doc-editor-core/dist/UIModel/TextUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState, TextareaForTableCell} from './TableUIViewCellCommon';

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

const useTableCellEditState = makeUseTableCellEditState<TextUIModel>((model) => model.value ?? '');

export const TextUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const {editingText, isEditing, dispatch, startEdit} = useTableCellEditState(
    model,
    isMainSelected,
    (model, textInput) => callbacks.onAction(textUIModelSetText(model, textInput)),
  );
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const change = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch(['changeText', e.target.value]),
    // dispatchは不変のため、depsには不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const blur = useCallback(() => {
    callbacks.onAction(textUIModelSetText(model, editingText));
  }, [callbacks, editingText, model]);

  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onMouseUp={() => textAreaRef.current?.focus()}
      onDoubleClick={startEdit}
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
