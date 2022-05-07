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

const LayoutRoot = styled.div`
  display: flex;
`;
const ListArea = styled.div``;
const List = styled.ul`
  border: black 1px solid;
  list-style-type: none;
  padding: 0;
  margin: 0;
  min-width: 80px;
  max-width: 160px;
`;
const ListItem = styled.li<{selected: boolean}>`
  border-bottom: gray 1px solid;
  background-color: ${({selected}) => (selected ? 'lightblue' : 'white')};
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
  const [contextMenuProp, setContextMenuProp] = useState<Omit<ContextMenuProps, 'onClose'>>();
  const closeContextMenu = useCallback(() => setContextMenuProp(undefined), []);
  const openContextMenu = useCallback(
    (index: number, event: React.MouseEvent<HTMLElement>) => {
      setContextMenuProp({
        anchorPoint: {x: event.pageX, y: event.pageY},
        items: [
          {label: '上に追加', onClick: () => onAction(contentListAddBeforeAction(model, index))},
          {label: '下に追加', onClick: () => onAction(contentListAddAfterAction(model, index))},
          {label: '削除', onClick: () => onAction(contentListRemoveAtAction(model, index))},
        ],
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
              onContextMenu={(e) => openContextMenu(index, e)}
            >
              {/* TODO labelはテンプレートなので、適切なコンポーネントを定義する必要がある */}
              {label}
            </ListItem>
          ))}
        </List>
        <ContextMenu {...contextMenuProp} onClose={closeContextMenu} />
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
