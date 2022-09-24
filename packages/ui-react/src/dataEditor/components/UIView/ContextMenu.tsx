import React, {useCallback} from 'react';
import styled from 'styled-components';

const LayoutRoot = styled.div``;

const ContextMenuBox = styled.div<{x: number; y: number}>`
  position: fixed;
  z-index: 100;
  border-radius: 5px;
  padding-top: 0.6em;
  padding-bottom: 0.6em;
  background-color: ${({theme}) => theme.color.bg.popup};
  font-size: ${({theme}) => theme.font.size.input};
  font-family: ${({theme}) => theme.font.family.input};
  color: ${({theme}) => theme.font.color.popup};
  top: ${({y}) => y}px;
  left: ${({x}) => x}px;
`;

const ContextMenuItemBox = styled.div`
  height: 24px;
  width: 180px;
  display: flex;
  align-items: center;
  padding-left: 5px;
  &:hover {
    background-color: ${({theme}) => theme.color.bg.itemSelection};
    color: ${({theme}) => theme.font.color.itemSelection};
  }
`;

const PopupBlanket = styled.div<{isVisible?: boolean}>`
  bottom: 0;
  left: 0;
  top: 0;
  right: 0;
  position: fixed;
  z-index: 1;
`;

export interface ContextMenuItem {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ContextMenuProps {
  readonly anchorPoint?: Record<'x' | 'y', number>;
  readonly items?: readonly ContextMenuItem[];
  readonly onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({anchorPoint, items, onClose}) => {
  const contextMenuCallback = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (anchorPoint) {
    return (
      <LayoutRoot onContextMenu={contextMenuCallback}>
        <ContextMenuBox {...anchorPoint}>
          {items?.map(({label, onClick}, index) => (
            <ContextMenuItemBox key={index} onClick={onClick}>
              {label}
            </ContextMenuItemBox>
          ))}
        </ContextMenuBox>
        <PopupBlanket onClick={onClose} />
      </LayoutRoot>
    );
  } else {
    return null;
  }
};
