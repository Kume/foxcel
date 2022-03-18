import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {UIViewProps} from './UIView';
import {SelectUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {
  filterSelectUIOptionsByText,
  getSelectUIOptions,
  selectUIModelDefaultOptions,
  selectUIModelSetValue,
  SelectUIOption,
} from 'co-doc-editor-core/dist/UIModel/SelectUIModel';
import {TableUIViewCellProps} from './TableUIViewCell';
import styled from 'styled-components';
import {flip, shift, useFloating} from '@floating-ui/react-dom';
import {TextareaForTableCell} from './TableUIViewCellCommon';

interface Props extends UIViewProps {
  readonly model: SelectUIModel;
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

  .dropdown {
    ${dropDownButtonStyle}
    div {
      ${dropDownButtonIconStyle}
    }
  }
  &:hover .dropdown div {
    ${dropDownButtonHoverIconStyle}
  }
`;

const InputArea = styled.div`
  min-width: 100px;
  border: 1px solid gray;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

export const SelectUIView: React.FC<Props> = ({model, onAction, getRoot}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [dropDownIsOpen, setDropDownIsOpen] = useState<boolean>(false);
  const [options, setOptions] = useState<SelectUIOption[]>(selectUIModelDefaultOptions(model));
  const filteredOptions = useMemo(() => filterSelectUIOptionsByText(options, editingText), [options, editingText]);
  const {x, y, reference, floating, strategy} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });
  const openDropdown = () => {
    setDropDownIsOpen((prev) => {
      if (!prev) {
        setOptions(getSelectUIOptions(model, getRoot()));
      }
      return true;
    });
  };
  const change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingText(e.target.value);
  };
  const blur = () => {
    setDropDownIsOpen(false);
    setEditingText('');
  };
  const select = (value: SelectUIOption | null) => {
    onAction(selectUIModelSetValue(model, value));
    setDropDownIsOpen(false);
    setEditingText('');
  };
  return (
    <LayoutRoot ref={reference}>
      <InputArea onClick={openDropdown}>
        <TableCellLabel>
          {editingText ? '　' : model.current?.label}
          <BackgroundTextPlace>{editingText}</BackgroundTextPlace>
          {dropDownIsOpen && (
            <TextareaForTableCell
              isVisible={!!editingText}
              ref={(ref) => {
                ref?.focus();
                textareaRef.current = ref;
              }}
              onChange={change}
              onBlur={blur}
              value={(dropDownIsOpen && editingText) || ''}
            />
          )}
        </TableCellLabel>
        <div className="dropdown">
          <div />
        </div>
      </InputArea>
      {dropDownIsOpen && (
        <DropDownMenuLayout
          ref={floating}
          style={{position: strategy, top: y ?? '', left: x ?? ''}}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredOptions.map((option, index) => {
            return (
              <DropDownMenuItem key={index} onClick={() => select(option)} tabIndex={-1}>
                {option.label}
              </DropDownMenuItem>
            );
          })}
        </DropDownMenuLayout>
      )}
    </LayoutRoot>
  );
};

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
  padding-right: 4px;
  color: transparent;
`;

const DropDownMenuItem = styled.div`
  padding: 2px 4px;
  overflow-wrap: break-word;
  word-break: keep-all;
  &:hover {
    background-color: lightblue;
  }
`;

interface PropsForTableCell extends TableUIViewCellProps {
  readonly model: SelectUIModel;
}

export const SelectUIViewForTableCell: React.FC<PropsForTableCell> = ({model, isMainSelected, row, col, callbacks}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingText, setEditingText] = useState<string>('');
  const [dropDownIsOpen, setDropDownIsOpen] = useState<boolean>(false);
  const [options, setOptions] = useState<SelectUIOption[]>(selectUIModelDefaultOptions(model));
  const filteredOptions = useMemo(() => filterSelectUIOptionsByText(options, editingText), [options, editingText]);
  const {x, y, reference, floating, strategy} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });

  const change = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditingText(e.target.value);
      setIsEditing(true);
      setDropDownIsOpen((prev) => {
        if (!prev) {
          setOptions(getSelectUIOptions(model, callbacks.getRoot()));
        }
        return true;
      });
    },
    [callbacks, model],
  );
  useEffect(() => {
    if (!isMainSelected) {
      setDropDownIsOpen(false);
      setIsEditing(false);
      setEditingText('');
    }
  }, [callbacks, isMainSelected, model]);
  const openDropdown = () => {
    setDropDownIsOpen(true);
    setOptions(getSelectUIOptions(model, callbacks.getRoot()));
  };
  const select = (value: SelectUIOption | null) => {
    callbacks.onAction(selectUIModelSetValue(model, value));
    setDropDownIsOpen(false);
    setIsEditing(false);
    setEditingText('');
  };

  return (
    <LayoutRootForTableCell
      ref={reference}
      onMouseDown={(e) => callbacks.onMouseDown(e, row, col)}
      onMouseOver={(e) => callbacks.onMouseOver(e, row, col)}
      onDoubleClick={() => setIsEditing(true)}
    >
      <TableCellLabel>
        {editingText ? '' : model.current?.label}
        <BackgroundTextPlace>{editingText}</BackgroundTextPlace>
        {isMainSelected && (
          <TextareaForTableCell
            isVisible={isEditing}
            ref={(ref) => ref?.focus()}
            onChange={change}
            onBlur={blur}
            value={(isEditing && editingText) || ''}
          />
        )}
      </TableCellLabel>
      <DropDownButton onClick={openDropdown}>
        <div />
      </DropDownButton>
      {dropDownIsOpen && (
        <DropDownMenuLayout ref={floating} style={{position: strategy, top: y ?? '', left: x ?? ''}}>
          {filteredOptions.map((option, index) => {
            return (
              <DropDownMenuItem key={index} onClick={() => select(option)}>
                {option.label}
              </DropDownMenuItem>
            );
          })}
        </DropDownMenuLayout>
      )}
    </LayoutRootForTableCell>
  );
};
