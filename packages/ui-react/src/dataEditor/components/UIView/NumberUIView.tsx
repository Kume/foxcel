import {UIViewProps} from './UIView';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {NumberUIModel} from '@foxcel/core/dist/UIModel/UIModelTypes';
import {
  numberUIModelDisplayText,
  numberUIModelHandleInputForSchema,
  numberUIModelSetText,
} from '@foxcel/core/dist/UIModel/NumberUIModel';
import {ModelOrSchemaHolder, TableUIViewCellProps} from './TableUIViewCell';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState} from './TableUIViewCellCommon';
import styled from 'styled-components';
import {NumberUISchema} from '@foxcel/core/dist/UIModel/UISchemaTypes';
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
      onChange={(e) => setEditingText(e.target.value)}
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

type PropsForTableCell = TableUIViewCellProps & ModelOrSchemaHolder<NumberUIModel, NumberUISchema>;

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

const useTableCellEditState = makeUseTableCellEditState<NumberUIModel, NumberUISchema>(numberUIModelDisplayText);

export const NumberUIViewForTableCell: React.FC<PropsForTableCell> = ({
  model,
  schema,
  isMainSelected,
  row,
  col,
  callbacks,
}) => {
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
  const changeWithSchema = (uiSchema: NumberUISchema, text: string) => {
    const result = numberUIModelHandleInputForSchema(uiSchema, text);
    if (result !== undefined) {
      schema?.onEdit(result);
    } else {
      dispatch(['resetText', '']);
    }
  };
  const changeTextInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch(['changeText', e.target.value]),
    // dispatchは不変のため、depsには不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const {editingText, isEditing, dispatch, startEdit} = useTableCellEditState(
    model,
    schema?.schema,
    isMainSelected,
    change,
    changeWithSchema,
  );

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const blur = () => {
    if (model) {
      change(model, editingText);
    } else if (schema) {
      changeWithSchema(schema.schema, editingText);
    }
  };

  return (
    <LayoutRootForTableCell
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onMouseUp={() => textAreaRef.current?.focus()}
      onDoubleClick={startEdit}
    >
      <TextWithBreak text={editingText ?? ''} />
      {isMainSelected && (
        <BackgroundTextarea
          isVisible={isEditing}
          ref={textAreaRef}
          onChange={changeTextInput}
          onBlur={blur}
          onKeyDown={(e) => callbacks.onKeyDown(e, isEditing)}
          value={(isEditing && editingText) || ''}
        />
      )}
    </LayoutRootForTableCell>
  );
};
