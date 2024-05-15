import React, {CSSProperties, useCallback} from 'react';
import styled from 'styled-components';
import {PopupBlanket} from '../../common/components/PopupBlanket';
import {DataModelValidationError, DataModelValidationErrors} from '@foxcel/core';

const LayoutRoot = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  max-width: 70%;
  max-height: 90%;
  z-index: 100;
  border-radius: 5px;
  padding-top: 0.6em;
  padding-bottom: 0.6em;
  background-color: ${({theme}) => theme.color.bg.popup};
  font-size: ${({theme}) => theme.font.size.input};
  font-family: ${({theme}) => theme.font.family.input};
  color: ${({theme}) => theme.font.color.popup};
`;

interface Props {
  readonly isOpen?: boolean;
  readonly style?: CSSProperties;
  readonly onClose: () => void;
  readonly errors: DataModelValidationErrors;
  onSelect(error: DataModelValidationError): void;
}

export const ErrorMenu = React.forwardRef<HTMLDivElement, Props>(function ErrorMenu(props, ref) {
  const {isOpen, style, onClose, errors} = props;
  const contextMenuCallback = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (isOpen) {
    return (
      <div onContextMenu={contextMenuCallback}>
        <LayoutRoot ref={ref} style={style}>
          {[...errors[0], ...errors[1]].map((error, index) => (
            <ErrorMenuItem key={index} error={error} onSelect={props.onSelect} />
          ))}
        </LayoutRoot>
        <PopupBlanket onClick={onClose} />
      </div>
    );
  } else {
    return null;
  }
});

const ItemLayoutRoot = styled.div`
  height: 24px;
  align-items: center;
  padding-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    background-color: ${({theme}) => theme.color.bg.itemSelection};
    color: ${({theme}) => theme.font.color.itemSelection};
  }
`;

interface ItemProps {
  readonly error: DataModelValidationError;
  onSelect(error: DataModelValidationError): void;
}

function ErrorMenuItem(props: ItemProps): React.ReactNode {
  return (
    <ItemLayoutRoot onClick={() => props.onSelect(props.error)}>
      {props.error[0]} : {JSON.stringify(props.error[1])}
    </ItemLayoutRoot>
  );
}
