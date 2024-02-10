import {UIViewProps} from './UIView';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {NumberUIModel, numberUIModelDisplayText, numberUIModelSetText, NumberUISchema} from '@foxcel/core';
import {TableUIViewCellProps} from './TableUIViewCell';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState} from './TableUIViewCellCommon';
import styled from 'styled-components';
import {BackgroundTextarea} from '../BackgroundTextarea';
import {inputTextStyle} from '../../../common/components/commonStyles';

const Input = styled.input`
  background-color: ${({theme}) => theme.color.bg.input};
  border: solid 1px ${({theme}) => theme.color.border.input};
  ${({theme}) => inputTextStyle(theme)}
  &:focus {
    border-color: ${({theme}) => theme.color.border.inputFocus};
    outline: none;
  }
`;

interface Props extends UIViewProps {
  readonly model: NumberUIModel;
}

export const NumberUIView: React.FC<Props> = ({model, onAction}) => {
  const [editingText, setEditingText] = useState<string>(numberUIModelDisplayText(model));
  useEffect(() => {
    setEditingText(numberUIModelDisplayText(model));
  }, [model]);
  return (
    <Input
      value={editingText}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingText(e.target.value)}
      onBlur={() => {
        const action = numberUIModelSetText(model, editingText);
        if (action) {
          onAction(action);
        } else {
          setEditingText('');
        }
      }}
    />
  );
};

type PropsForTableCell = TableUIViewCellProps & {readonly model: NumberUIModel};

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

const useTableCellEditState = makeUseTableCellEditState<NumberUIModel, NumberUISchema>(numberUIModelDisplayText);

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
  const blur = () => {
    change(model, editingText);
  };

  const stopPropagationIfEditing = useMemo(
    () => (isEditing ? (e: React.BaseSyntheticEvent) => e.stopPropagation() : undefined),
    [isEditing],
  );

  return (
    <LayoutRootForTableCell
      onMouseDown={(e: React.MouseEvent) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e: React.MouseEvent) => callbacks.onMouseOver(e, row, col)}
      onMouseUp={() => textAreaRef.current?.focus()}
      onDoubleClick={startEdit}>
      <TextWithBreak text={editingText ?? ''} hidden={isEditing} />
      {isMainSelected && (
        <BackgroundTextarea
          $isVisible={isEditing}
          ref={textAreaRef}
          onChange={changeTextInput}
          onBlur={blur}
          onCopy={stopPropagationIfEditing}
          onPaste={stopPropagationIfEditing}
          onCut={stopPropagationIfEditing}
          onKeyDown={(e: React.KeyboardEvent) => callbacks.onKeyDown(e, isEditing)}
          value={(isEditing && editingText) || ''}
        />
      )}
    </LayoutRootForTableCell>
  );
};
