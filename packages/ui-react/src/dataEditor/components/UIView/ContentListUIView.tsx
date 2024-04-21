import React, {useCallback, useState} from 'react';
import {UIView, UIViewProps} from './UIView';
import {
  AppAction,
  contentListAddAfterAction,
  contentListAddBeforeAction,
  contentListRemoveAtAction,
  ContentListUIModel,
  getIdFromDataPointer,
} from '@foxcel/core';
import styled from 'styled-components';
import {ContextMenu, ContextMenuProps, makeClickPointVirtualElement} from './ContextMenu';
import {labelTextStyle} from '../../../common/components/commonStyles';
import {flip, shift, useFloating} from '@floating-ui/react';

const LayoutRoot = styled.div`
  display: flex;
`;
const ListArea = styled.div``;
const List = styled.ul`
  border: ${({theme}) => theme.color.border.list} 1px solid;
  list-style-type: none;
  padding: 0;
  margin: 0;
  min-width: 80px;
  max-width: 160px;
`;
const ListItem = styled.li<{selected: boolean}>`
  background-color: ${({selected, theme}) => (selected ? theme.color.bg.itemSelection : theme.color.bg.normal)};
  ${({theme}) => labelTextStyle(theme)}
  height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;
const ContentArea = styled.div`
  margin-left: 10px;
`;
const EmptyContentArea = styled.div``;

interface Props extends UIViewProps {
  readonly model: ContentListUIModel;
}

export const ContentListUIView: React.FC<Props> = ({model, onAction, getRoot}) => {
  const [contextMenuProp, setContextMenuProp] = useState<Pick<ContextMenuProps, 'isOpen' | 'items'>>();
  const {refs: floatingRefs, floatingStyles} = useFloating({
    placement: 'bottom-start',
    middleware: [shift(), flip()],
  });
  const closeContextMenu = useCallback(() => setContextMenuProp(undefined), []);
  const openContextMenu = useCallback(
    (index: number, event: React.MouseEvent<HTMLElement>) => {
      const actionAndClose = (action: AppAction) => {
        onAction(action);
        setContextMenuProp(undefined);
      };
      setContextMenuProp({
        isOpen: true,
        items: [
          {label: 'Insert above', onClick: () => actionAndClose(contentListAddBeforeAction(model, index))},
          {label: 'Insert below', onClick: () => actionAndClose(contentListAddAfterAction(model, index))},
          {label: 'Delete', onClick: () => actionAndClose(contentListRemoveAtAction(model, index))},
        ],
      });
      floatingRefs.setPositionReference(makeClickPointVirtualElement(event));
      event.preventDefault();
    },
    [model, onAction, floatingRefs],
  );

  return (
    <LayoutRoot>
      <ListArea>
        <List>
          {model.indexes.map(({label, pointer, dataContext}, index) => (
            <ListItem
              key={getIdFromDataPointer(pointer)}
              title={label.join('')}
              selected={model.currentIndex === index}
              onClick={() => onAction({type: 'focus', dataContext})}
              onContextMenu={(e: React.MouseEvent<HTMLElement>) => openContextMenu(index, e)}>
              {/* TODO labelはテンプレートなので、適切なコンポーネントを定義する必要がある */}
              {label}
            </ListItem>
          ))}
        </List>
        <ContextMenu
          ref={floatingRefs.setFloating}
          style={floatingStyles}
          {...contextMenuProp}
          onClose={closeContextMenu}
        />
      </ListArea>
      <ContentArea>
        {model.content ? (
          <UIView model={model.content} onAction={onAction} getRoot={getRoot} />
        ) : (
          <EmptyContentArea>
            リストが空です。
            <input type="button" value="追加" onClick={() => onAction(contentListAddAfterAction(model, 0))} />
          </EmptyContentArea>
        )}
      </ContentArea>
    </LayoutRoot>
  );
};
