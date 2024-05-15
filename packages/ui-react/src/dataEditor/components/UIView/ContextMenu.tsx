import React, {CSSProperties, useCallback} from 'react';
import styled from 'styled-components';
import {VirtualElement} from '@floating-ui/dom';
import {PopupBlanket} from '../../../common/components/PopupBlanket';

export function makeClickPointVirtualElement(e: React.MouseEvent): VirtualElement {
  return {
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      left: e.clientX,
      right: e.clientX,
      bottom: e.clientY,
      top: e.clientY,
    }),
  };
}

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

export const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(props, ref) {
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
