import React, {useCallback, useState} from 'react';
import {UIView, UIViewProps} from './UIView';
import {ContentListUIModel} from '@foxcel/core/dist/UIModel/UIModelTypes';
import styled from 'styled-components';
import {ContextMenu, ContextMenuProps} from './ContextMenu';
import {getIdFromDataPointer} from '@foxcel/core';
import {
  contentListAddAfterAction,
  contentListAddBeforeAction,
  contentListRemoveAtAction,
} from '@foxcel/core/dist/UIModel/ContentListUIModel';
import {labelTextStyle} from '../../../common/components/commonStyles';
import {AppAction} from '@foxcel/core/dist/App/AppState';
import {flip, shift, useFloating} from '@floating-ui/react-dom';

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
  const {x, y, reference, floating, strategy} = useFloating({
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
      reference({
        getBoundingClientRect: () => ({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          left: event.clientX,
          right: event.clientX,
          bottom: event.clientY,
          top: event.clientY,
        }),
      });
      event.preventDefault();
    },
    [model, onAction],
  );

  return (
    <LayoutRoot>
      <ListArea>
        <List>
          {model.indexes.map(({label, pointer, dataPath}, index) => (
            <ListItem
              key={getIdFromDataPointer(pointer)}
              title={label.join('')}
              selected={model.currentIndex === index}
              onClick={() => onAction({type: 'focus', path: dataPath})}
              onContextMenu={(e: React.MouseEvent<HTMLElement>) => openContextMenu(index, e)}>
              {/* TODO labelはテンプレートなので、適切なコンポーネントを定義する必要がある */}
              {label}
            </ListItem>
          ))}
        </List>
        <ContextMenu
          ref={floating}
          style={{position: strategy, left: x ?? 0, top: y ?? 0}}
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
