import React from 'react';
import styled from 'styled-components';

const LayoutRoot = styled.div``;

const ContextMenuBox = styled.div`
  position: absolute;
  background-color: white;
  box-shadow: 1px 3px 6px rgba(0, 0, 0, 0.4);
  z-index: 100;
  border-radius: 5px;
`;

const ContextMenuItemBox = styled.div`
  height: 24px;
  width: 180px;
  display: flex;
  align-items: center;
  padding-left: 5px;
  &:hover {
    background-color: lightblue;
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
  if (anchorPoint) {
    return (
      <LayoutRoot>
        <ContextMenuBox>
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
