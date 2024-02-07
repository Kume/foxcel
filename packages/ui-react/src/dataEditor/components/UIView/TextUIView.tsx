import {TextUIModel, textUIModelSetText, TextUISchema} from '@foxcel/core';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState} from './TableUIViewCellCommon';
import {KeyValue_Enter, withAltKey} from '../../../common/Keybord';
import {BackgroundTextarea} from '../BackgroundTextarea';
import {inputTextStyle} from '../../../common/components/commonStyles';

const LayoutRoot = styled.div`
  display: flex;
  justify-content: flex-start;
`;

const InputBox = styled.div`
  position: relative;
  min-width: 100px;
  max-width: 500px;
  overflow: hidden;
  padding: 2px;
`;

const InputBoxForMultiline = styled(InputBox)`
  position: relative;
  padding: 0 4px;
`;

const Input = styled.input`
  background-color: ${({theme}) => theme.color.bg.input};
  border: solid 1px ${({theme}) => theme.color.border.input};
  ${({theme}) => inputTextStyle(theme)}
  position: absolute;
  width: calc(100% - 8px);
  height: calc(100% - 6px);
  left: 1px;
  top: 1px;
  &:focus {
    border-color: ${({theme}) => theme.color.border.inputFocus};
    outline: none;
  }
`;

const InputForMultiline = styled(BackgroundTextarea)`
  background-color: ${({theme}) => theme.color.bg.input};
  border: solid 1px ${({theme}) => theme.color.border.input};
  width: calc(100% - 8px);
  height: 100%;
  &:focus {
    border-color: ${({theme}) => theme.color.border.inputFocus};
  }
`;

const BackgroundText = styled.p`
  ${({theme}) => inputTextStyle(theme)}
  margin: 0;
  margin-right: 4px;
  max-width: 500px;
`;

export interface TextUIViewProps extends UIViewProps {
  readonly model: TextUIModel;
}

export const TextUIView: React.FC<TextUIViewProps> = ({model, onAction}) => {
  const [value, setValue] = useState(model.value ?? '');
  useEffect(() => {
    setValue(model.value ?? '');
  }, [model.value]);
  if (model.schema?.multiline) {
    return (
      <LayoutRoot>
        <InputBoxForMultiline>
          <TextWithBreak text={value} hidden />
          <InputForMultiline
            $isVisible
            value={value}
            onChange={(e: React.FocusEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => onAction(textUIModelSetText(model, e.target.value))}
          />
        </InputBoxForMultiline>
      </LayoutRoot>
    );
  } else {
    return (
      <LayoutRoot>
        <InputBox>
          <BackgroundText>{value || '　'}</BackgroundText>
          <Input
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => onAction(textUIModelSetText(model, e.target.value))}
          />
        </InputBox>
      </LayoutRoot>
    );
  }
};

type PropsForTableCell = TableUIViewCellProps & {readonly model: TextUIModel};

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

const useTableCellEditState = makeUseTableCellEditState<TextUIModel, TextUISchema>((model) => model.value ?? '');

export const TextUIViewForTableCell: React.FC<PropsForTableCell> = ({
  model,
  isMainSelected,
  disabled,
  row,
  col,
  callbacks,
}) => {
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
  const blur = () => {
    callbacks.onAction(textUIModelSetText(model, editingText));
  };

  useEffect(() => {
    if (isMainSelected) {
      textAreaRef.current?.focus();
    }
  }, [isMainSelected]);

  return (
    <LayoutRootForTableCell
      onMouseDown={(e: React.MouseEvent) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e: React.MouseEvent) => callbacks.onMouseOver(e, row, col)}
      onMouseUp={() => textAreaRef.current?.focus()}
      onDoubleClick={startEdit}>
      <TextWithBreak text={editingText ?? ''} hidden={isEditing} />
      {isMainSelected && !disabled && (
        <BackgroundTextarea
          $isVisible={isEditing}
          ref={textAreaRef}
          onChange={change}
          onBlur={blur}
          value={(isEditing && editingText) || ''}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (!callbacks.onKeyDown(e, isEditing)) {
              // TODO multilineのときのみこの操作を許可
              if (e.key === KeyValue_Enter && withAltKey(e) && textAreaRef.current) {
                const start = textAreaRef.current.selectionStart;
                const end = textAreaRef.current.selectionEnd;

                // 値を更新したときにキャレットが最後に移動してしまう対策
                // reactの値更新時に値を更新するとキャレット移動のタイミングが難しくなるので、この時点で値をセットしてキャレット移動してしまう
                const nextText = editingText.slice(0, start) + '\n' + editingText.slice(end);
                textAreaRef.current.setSelectionRange(start + 1, start + 1);

                dispatch(['changeText', nextText]);
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}
        />
      )}
    </LayoutRootForTableCell>
  );
};
