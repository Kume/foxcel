import {TextUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import React, {useCallback, useRef} from 'react';
import {UIViewProps} from './UIView';
import {textUIModelHandleInputForSchema, textUIModelSetText} from 'co-doc-editor-core/dist/UIModel/TextUIModel';
import {ModelOrSchemaHolder, TableUIViewCellProps, TableUIViewCellSchemaInfo} from './TableUIViewCell';
import styled from 'styled-components';
import {TextWithBreak} from '../../../common/TextWithBreak';
import {makeUseTableCellEditState, TextareaForTableCell} from './TableUIViewCellCommon';
import {TextUISchema} from 'co-doc-editor-core/dist/UIModel/UISchemaTypes';

export interface TextUIViewProps extends UIViewProps {
  readonly model: TextUIModel;
}

export const TextUIView: React.FC<TextUIViewProps> = ({model, onAction}) => {
  return <input value={model.value ?? ''} onChange={(e) => onAction(textUIModelSetText(model, e.target.value))} />;
};

type PropsForTableCell = TableUIViewCellProps & ModelOrSchemaHolder<TextUIModel, TextUISchema>;

const LayoutRootForTableCell = styled.div`
  position: relative;
  padding: 0 4px;
`;

const useTableCellEditState = makeUseTableCellEditState<TextUIModel, TextUISchema>((model) => model.value ?? '');

export const TextUIViewForTableCell: React.FC<PropsForTableCell> = ({
  model,
  schema,
  isMainSelected,
  row,
  col,
  callbacks,
}) => {
  const changeWithSchema = (uiSchema: TextUISchema, text: string) => {
    const result = textUIModelHandleInputForSchema(uiSchema, text);
    if (result.type === 'key') {
      throw new Error('schemaプロパティ利用時にkey指定のschemaは入ってこないはず。');
    } else {
      schema?.onEdit(result.value);
    }
  };
  const {editingText, isEditing, dispatch, startEdit} = useTableCellEditState(
    model,
    schema?.schema,
    isMainSelected,
    (model, textInput) => callbacks.onAction(textUIModelSetText(model, textInput)),
    changeWithSchema,
  );
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const change = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch(['changeText', e.target.value]),
    // dispatchは不変のため、depsには不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const blur = () => {
    if (model) {
      callbacks.onAction(textUIModelSetText(model, editingText));
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
