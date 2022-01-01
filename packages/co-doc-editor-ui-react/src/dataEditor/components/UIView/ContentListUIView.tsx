import React, {useCallback, useState} from 'react';
import {UIView, UIViewProps} from './UIView';
import {ContentListUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import styled from 'styled-components';
import {ContextMenu, ContextMenuProps} from './ContextMenu';
import {getIdFromDataPointer} from 'co-doc-editor-core';

const LayoutRoot = styled.div`
  display: flex;
`;
const ListArea = styled.div``;
const List = styled.ul`
  border: black 1px solid;
  list-style-type: none;
  padding: 0;
  margin: 0;
  width: 100px;
`;
const ListItem = styled.li<{selected: boolean}>`
  border-bottom: gray 1px solid;
  background-color: ${({selected}) => (selected ? 'lightblue' : 'white')};
`;
const ContentArea = styled.div`
  margin-left: 10px;
`;
const EmptyContentArea = styled.div``;

interface Props extends UIViewProps {
  readonly model: ContentListUIModel;
}

export const ContentListUIView: React.FC<Props> = ({model, ...otherProps}) => {
  const [contextMenuProp, setContextMenuProp] = useState<Omit<ContextMenuProps, 'onClose'>>();
  const closeContextMenu = useCallback(() => setContextMenuProp(undefined), []);
  return (
    <LayoutRoot>
      <ListArea>
        <List>
          {model.indexes.map(({label, pointer, dataPath}, index) => (
            <ListItem
              key={getIdFromDataPointer(pointer)}
              title={label}
              selected={model.currentIndex === index}
              onClick={() => otherProps.onAction({type: 'focus', path: dataPath})}
              onContextMenu={(e) => {
                setContextMenuProp({
                  anchorPoint: {x: e.pageX, y: e.pageY},
                  items: [
                    {label: '上に追加', onClick: () => console.log('xxxx 上に追加')},
                    {label: '下に追加', onClick: () => console.log('xxxx 下に追加')},
                    {label: '削除', onClick: () => console.log('xxxx 削除')},
                  ],
                });
                e.preventDefault();
              }}>
              {label}
            </ListItem>
          ))}
        </List>
        <ContextMenu {...contextMenuProp} onClose={closeContextMenu} />
      </ListArea>
      <ContentArea>
        {model.content ? (
          <UIView model={model.content} {...otherProps} />
        ) : (
          <EmptyContentArea>リストが空です。</EmptyContentArea>
        )}
      </ContentArea>
    </LayoutRoot>
  );
};
