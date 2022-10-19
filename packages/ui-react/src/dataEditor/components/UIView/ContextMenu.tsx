import React, {ComponentType, CSSProperties, forwardRef, useCallback} from 'react';
import styled from 'styled-components';

const LayoutRoot = styled.div``;

const ContextMenuBox = styled.div`
  position: fixed;
  z-index: 100;
  border-radius: 5px;
  padding-top: 0.6em;
  padding-bottom: 0.6em;
  background-color: ${({theme}) => theme.color.bg.popup};
  font-size: ${({theme}) => theme.font.size.input};
  font-family: ${({theme}) => theme.font.family.input};
  color: ${({theme}) => theme.font.color.popup};
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
  readonly isOpen?: boolean;
  readonly items?: readonly ContextMenuItem[];
  readonly style?: CSSProperties;
  readonly onClose: () => void;
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(props, ref) {
  const {isOpen, items, style, onClose} = props;
  const contextMenuCallback = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (isOpen) {
    return (
      <LayoutRoot onContextMenu={contextMenuCallback}>
        <ContextMenuBox ref={ref} style={style}>
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
});
