import React, {useEffect, useMemo, useReducer, useRef} from 'react';
import {UIViewProps} from './UIView';
import {MultiSelectUIModel, SelectUIModel, SingleSelectUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {
  filterSelectUIOptionsByText,
  getSelectUIOptions,
  getSelectUIOptionsWithSchema,
  selectUIModelCurrentLabel,
  selectUIModelHandleInputForSchema,
  selectUIModelSetValue,
  SelectUIOption,
} from 'co-doc-editor-core/dist/UIModel/SelectUIModel';
import {ModelOrSchemaHolder, TableUIViewCellProps, TableUIViewCellSchemaInfo} from './TableUIViewCell';
import styled from 'styled-components';
import {flip, shift, useFloating} from '@floating-ui/react-dom';
import {TextareaForTableCell} from './TableUIViewCellCommon';
import {SelectUISchema} from 'co-doc-editor-core/dist/UIModel/UISchemaTypes';
import {VscClose} from 'react-icons/vsc';
import {AppAction} from 'co-doc-editor-core/dist/App/AppState';
import {DataModelRoot} from 'co-doc-editor-core/dist/DataModel/DataModelContext';
import {
  KeyValue_ArrowDown,
  KeyValue_ArrowUp,
  KeyValue_Backspace,
  KeyValue_Delete,
  KeyValue_Enter,
  KeyValue_Escape,
  KeyValue_Tab,
} from '../../../common/Keybord';

interface State {
  readonly isEditing: boolean;
  readonly editingText: string;
  readonly options: readonly SelectUIOption[];
  readonly isOpen: boolean;
  readonly currentIndex?: number;
}

type GetOptionParams = [
  getRoot: () => DataModelRoot,
  model: SelectUIModel | undefined,
  schema?: TableUIViewCellSchemaInfo<SelectUISchema>,
];

type Action =
  | [type: 'setOptions', options: readonly SelectUIOption[]]
  | [type: 'blur']
  | ['change', string, ...GetOptionParams]
  | ['open', ...GetOptionParams]
  | ['up', readonly SelectUIOption[], ...GetOptionParams]
  | ['down', readonly SelectUIOption[], ...GetOptionParams];

function getOptions(
  getRoot: () => DataModelRoot,
  model: SelectUIModel | undefined,
  schema: TableUIViewCellSchemaInfo<SelectUISchema> | undefined,
): readonly SelectUIOption[] {
  if (model) {
    return getSelectUIOptions(model, getRoot());
  } else if (schema) {
    return getSelectUIOptionsWithSchema(schema.schema, schema.dataContext, getRoot());
  }
  return [];
}

const initialState: State = {isEditing: false, editingText: '', options: [], isOpen: false};

function reducer(prev: State, action: Action): State {
  switch (action[0]) {
    case 'blur':
      return {
        ...prev,
        isEditing: false,
        editingText: '',
        isOpen: false,
        currentIndex: undefined,
      };
    case 'setOptions':
      return {...prev, options: action[1]};
    case 'change': {
      const [, value, getRoot, model, schema] = action;
      return {
        isEditing: true,
        editingText: value,
        options: prev.isOpen ? prev.options : getOptions(getRoot, model, schema),
        isOpen: true,
        currentIndex: undefined,
      };
    }
    case 'open': {
      const [, getRoot, model, schema] = action;
      return {
        ...prev,
        options: getOptions(getRoot, model, schema),
        isOpen: true,
        currentIndex: undefined,
      };
    }
    case 'up': {
      const [, , getRoot, model, schema] = action;
      return {
        ...prev,
        isEditing: true,
        options: prev.isOpen ? prev.options : getOptions(getRoot, model, schema),
        isOpen: true,
        currentIndex: prev.currentIndex === undefined ? 0 : Math.max(prev.currentIndex - 1, 0),
      };
    }
    case 'down': {
      const [, filteredOptions, getRoot, model, schema] = action;
      return {
        ...prev,
        isEditing: true,
        options: prev.isOpen ? prev.options : getOptions(getRoot, model, schema),
        isOpen: true,
        currentIndex: prev.currentIndex === undefined ? 0 : Math.min(prev.currentIndex + 1, filteredOptions.length - 1),
      };
    }
  }
}

const dropDownButtonStyle = `
  height: 16pt;
  width: 16pt;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const dropDownButtonIconStyle = `
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 8px 6px 0 6px;
  border-color: lightgray transparent transparent transparent;
 `;

const dropDownButtonHoverIconStyle = `border-color: gray transparent transparent transparent;`;

const LayoutRoot = styled.div`
  position: relative;
  display: flex;

  .dropdown {
    ${dropDownButtonStyle}
    div {
      ${dropDownButtonIconStyle}
    }
  }
`;

const InnerLayout = styled.div`
  min-width: 100px;
  border: 1px solid gray;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  position: relative;

  &:hover .dropdown div {
    ${dropDownButtonHoverIconStyle}
  }
`;

const InputArea = styled.div`
  padding-left: 4px;
  position: relative;
  overflow-wrap: break-word;
  word-break: keep-all;
  display: flex;
  flex-wrap: wrap;
`;

const TextArea = styled.div<{isMulti: boolean | undefined}>`
  min-width: ${({isMulti}) => (isMulti ? '40px' : '0')};
  position: relative;
  display: flex;
`;

interface Props extends UIViewProps {
  readonly model: SelectUIModel;
}

export const SelectUIView: React.FC<Props> = ({model, onAction, getRoot}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const filteredOptions = useMemo(() => filterSelectUIOptionsByText(state.options, state.editingText), [
    state.options,
    state.editingText,
  ]);
  const {x, y, reference, floating, strategy} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });
  const openDropdown = () => {
    dispatch(['open', getRoot, model]);
    textareaRef.current?.focus();
  };
  const change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(['change', e.target.value, getRoot, model]);
    textareaRef.current?.focus();
  };
  const select = (value: SelectUIOption | null) => {
    onAction(selectUIModelSetValue(model, value));
    dispatch(['blur']);
  };
  const keyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case KeyValue_ArrowUp:
        dispatch(['up', filteredOptions, getRoot, model]);
        e.preventDefault();
        break;
      case KeyValue_ArrowDown:
        dispatch(['down', filteredOptions, getRoot, model]);
        e.preventDefault();
        break;
      case KeyValue_Enter: {
        e.preventDefault();
        const value = state.currentIndex !== undefined && filteredOptions[state.currentIndex];
        if (value) {
          onAction(selectUIModelSetValue(model, value));
          dispatch(['blur']);
        }
        break;
      }
      case KeyValue_Escape:
        e.preventDefault();
        dispatch(['blur']);
        break;
      case KeyValue_Tab:
        e.preventDefault();
        break;
      case KeyValue_Delete:
      case KeyValue_Backspace:
        select(null);
        dispatch(['blur']);
        break;
    }
  };
  return (
    <LayoutRoot>
      <InnerLayout ref={reference} onClick={openDropdown}>
        <InputArea>
          {model.isMulti ? (
            <MultiSelectInput model={model} onAction={onAction} />
          ) : (
            renderSingleLabel(state.editingText, model)
          )}
          <TextArea isMulti={model.isMulti}>
            <BackgroundTextPlace>{state.editingText}</BackgroundTextPlace>
            <TextareaForTableCell
              isVisible={!!state.editingText}
              ref={textareaRef}
              onChange={change}
              onBlur={() => dispatch(['blur'])}
              value={(state.isOpen && state.editingText) || ''}
              onKeyDown={keyDown}
            />
          </TextArea>
        </InputArea>
        <div className="dropdown">
          <div />
        </div>
        {state.isOpen && (
          <DropDownMenuLayout
            ref={floating}
            style={{position: strategy, top: y ?? '', left: x ?? ''}}
            onMouseDown={(e) => e.preventDefault()}
          >
            {renderDropDownItems(model.isMulti, state.currentIndex, filteredOptions, select)}
          </DropDownMenuLayout>
        )}
      </InnerLayout>
    </LayoutRoot>
  );
};

function renderDropDownItems(
  isMulti: boolean | undefined,
  currentIndex: number | undefined,
  filteredOptions: readonly SelectUIOption[],
  select: (value: SelectUIOption | null) => void,
): React.ReactNode {
  return (
    <>
      {!isMulti && (
        <DropDownMenuItem
          hasFocus={undefined === currentIndex}
          onClick={(e) => {
            e.stopPropagation();
            select(null);
          }}
        >
          {'　'}
        </DropDownMenuItem>
      )}
      {filteredOptions.map((option, index) => {
        return (
          <DropDownMenuItem
            key={index}
            hasFocus={index === currentIndex}
            onClick={(e) => {
              e.stopPropagation();
              select(option);
            }}
          >
            {option.label}
          </DropDownMenuItem>
        );
      })}
    </>
  );
}

const LayoutRootForTableCell = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

/**
 * セルの右側に表示する、ドロップダウンを表示させるためのボタン
 * 子divは下向き三角形のアイコン
 */
const DropDownButton = styled.div`
  ${dropDownButtonStyle}

  div {
    ${dropDownButtonIconStyle}
  }
  &:hover div {
    ${dropDownButtonHoverIconStyle}
  }
`;

const DropDownMenuLayout = styled.div`
  z-index: 10;
  max-width: 300px;
  min-width: 100%;
  min-height: 10px;
  max-height: 500px;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: white;
  border: lightgray 1px solid;
  box-shadow: 2px 2px 6px 2px rgba(0, 0, 0, 0.1);
`;

const TableCellLabel = styled.div`
  padding-left: 4px;
  position: relative;
  overflow-wrap: break-word;
  word-break: keep-all;
`;

const BackgroundTextPlace = styled.span`
  padding: 0 4px;
  color: transparent;
`;

const DropDownMenuItem = styled.div<{hasFocus: boolean}>`
  padding: 2px 4px;
  white-space: nowrap;
  &:hover {
    background-color: lightblue;
  }
  background-color: ${({hasFocus}) => (hasFocus ? '#ddd' : 'white')};
`;

const InputAreaForTableCell = styled(TableCellLabel)`
  display: flex;
`;

type PropsForTableCell = TableUIViewCellProps & ModelOrSchemaHolder<SelectUIModel, SelectUISchema>;

export const SelectUIViewForTableCell: React.FC<PropsForTableCell> = ({
  model,
  schema,
  isMainSelected,
  disabled,
  row,
  col,
  callbacks,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const filteredOptions = useMemo(() => filterSelectUIOptionsByText(state.options, state.editingText), [
    state.options,
    state.editingText,
  ]);
  const {x, y, reference, floating, strategy} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!disabled) {
      dispatch(['change', e.target.value, callbacks.getRoot, model, schema]);
    }
  };
  useEffect(() => {
    if (!isMainSelected) {
      dispatch(['blur']);
    } else {
      textAreaRef.current?.focus();
    }
  }, [isMainSelected, model]);
  const openDropdown = () => {
    if (!disabled) {
      dispatch(['open', callbacks.getRoot, model, schema]);
    }
  };
  const select = (value: SelectUIOption | null) => {
    if (model) {
      callbacks.onAction(selectUIModelSetValue(model, value));
    } else if (schema) {
      const result = selectUIModelHandleInputForSchema(
        schema.schema,
        value?.value ?? null,
        schema.dataContext,
        callbacks.getRoot(),
      );
      if (result !== undefined) {
        schema.onEdit(result);
      }
    }
    dispatch(['blur']);
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (state.isOpen) {
      switch (e.key) {
        case KeyValue_ArrowUp:
          dispatch(['up', filteredOptions, callbacks.getRoot, model, schema]);
          e.preventDefault();
          break;
        case KeyValue_ArrowDown:
          dispatch(['down', filteredOptions, callbacks.getRoot, model, schema]);
          e.preventDefault();
          break;
        case KeyValue_Enter: {
          e.preventDefault();
          const value = state.currentIndex !== undefined && filteredOptions[state.currentIndex];
          if (value) {
            select(value);
          }
          break;
        }
        case KeyValue_Escape:
          e.preventDefault();
          dispatch(['blur']);
          break;
        case KeyValue_Tab:
          e.preventDefault();
          break;
        case KeyValue_Delete:
        case KeyValue_Backspace:
          select(null);
          dispatch(['blur']);
          break;
      }
    } else {
      callbacks.onKeyDown(e, state.isEditing);
    }
  };
  const isMulti = model?.isMulti || schema?.schema.isMulti;

  return (
    <LayoutRootForTableCell
      ref={reference}
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onDoubleClick={() => dispatch(['open', callbacks.getRoot, model, schema])}
    >
      <InputAreaForTableCell>
        {model?.isMulti ? (
          <MultiSelectInput model={model} onAction={callbacks.onAction} />
        ) : (
          renderSingleLabel(state.editingText, model)
        )}
        <TextArea isMulti={isMulti}>
          <BackgroundTextPlace>{state.editingText}</BackgroundTextPlace>
          {isMainSelected && (
            <TextareaForTableCell
              isVisible={state.isEditing}
              ref={textAreaRef}
              onChange={change}
              onKeyDown={keyDown}
              value={(state.isEditing && state.editingText) || ''}
            />
          )}
        </TextArea>
      </InputAreaForTableCell>
      <DropDownButton onClick={openDropdown}>
        <div />
      </DropDownButton>
      {state.isOpen && (
        <DropDownMenuLayout ref={floating} style={{position: strategy, top: y ?? '', left: x ?? ''}}>
          {renderDropDownItems(isMulti, state.currentIndex, filteredOptions, select)}
        </DropDownMenuLayout>
      )}
    </LayoutRootForTableCell>
  );
};

const MultiSelectInputSelectedItem = styled.span<{hasError?: boolean}>`
  border: ${({hasError}) => (hasError ? 'red 2px solid' : 'darkgray 1px solid')};
  border-radius: 4px;
  margin: 2px;
  padding: 0 4px;
  display: flex;
  align-items: center;
`;

const CloseItemIconArea = styled.div`
  margin-left: 4px;
  display: flex;
  justify-content: center;
  &:hover {
    background-color: #ddd;
  }
`;

const ErrorLabel = styled.span`
  text-decoration: underline wavy red;
`;

interface MultiSelectInputProps {
  readonly model: MultiSelectUIModel;
  onAction(action: AppAction): void;
}

const MultiSelectInput: React.FC<MultiSelectInputProps> = ({model, onAction}) => {
  return (
    <>
      {model.currents.map((current, index) => {
        const click = (e: React.MouseEvent) => {
          e.stopPropagation();
          onAction({type: 'data', action: {type: 'delete', path: current.dataPath}});
        };
        if (current.isInvalid) {
          return (
            <MultiSelectInputSelectedItem hasError={true} key={index}>
              <ErrorLabel>{selectUIModelCurrentLabel(current)}</ErrorLabel>
              <CloseItemIconArea onClick={click}>
                <VscClose />
              </CloseItemIconArea>
            </MultiSelectInputSelectedItem>
          );
        } else {
          return (
            <MultiSelectInputSelectedItem key={index}>
              {selectUIModelCurrentLabel(current)}
              <CloseItemIconArea onClick={click}>
                <VscClose />
              </CloseItemIconArea>
            </MultiSelectInputSelectedItem>
          );
        }
      })}
    </>
  );
};

function renderSingleLabel(editingText: string, model: SingleSelectUIModel | undefined): React.ReactNode {
  if (editingText || model === undefined) {
    return '';
  }
  if (model.current?.isInvalid) {
    return <ErrorLabel>Error</ErrorLabel>;
  } else {
    return selectUIModelCurrentLabel(model.current);
  }
}
