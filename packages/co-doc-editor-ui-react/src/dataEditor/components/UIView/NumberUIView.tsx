import {UIViewProps} from './UIView';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {NumberUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {numberUIModelDisplayText, numberUIModelSetText} from 'co-doc-editor-core/dist/UIModel/NumberUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState, TextareaForTableCell} from './TableUIViewCellCommon';
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

const useTableCellEditState = makeUseTableCellEditState<NumberUIModel>(numberUIModelDisplayText);

export const NumberUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const change = useCallback(
    (model: NumberUIModel, textInput: string) => {
      const action = numberUIModelSetText(model, textInput);
      if (action) {
        callbacks.onAction(action);
      } else {
        dispatch(['resetText', numberUIModelDisplayText(model)]);
      }
    },
    // dispatchは不変のため、depsには不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callbacks],
  );
  const changeTextInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch(['changeText', e.target.value]),
    // dispatchは不変のため、depsには不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const {editingText, isEditing, dispatch, startEdit} = useTableCellEditState(model, isMainSelected, change);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const blur = useCallback(() => {
    change(model, editingText);
  }, [change, editingText, model]);

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
          onChange={changeTextInput}
          onBlur={blur}
          value={(isEditing && editingText) || ''}
        />
      )}
    </LayoutRootForTableCell>
  );
};
