import {DataModelValidationErrors} from '@foxcel/core';
import React, {useContext} from 'react';
import styled, {ThemeContext} from 'styled-components';
import {FaExclamationCircle, FaExclamationTriangle} from 'react-icons/fa';

const LayoutRoot = styled.div`
  display: flex;
  align-items: center;
  background-color: ${(props) => props.theme.color.bg.label};
  margin: 4px 6px;
`;

const Display = styled.div`
  display: flex;
  align-items: center;
  margin: 2px 8px;
`;

const Count = styled.div`
  margin-left: 4px;
`;

interface DisplayProps {
  readonly errors: DataModelValidationErrors;
  readonly onErrorOpen: () => void;
}

export const ErrorDisplay = React.forwardRef<HTMLDivElement, DisplayProps>(function ErrorDisplay(
  {errors, onErrorOpen},
  ref,
) {
  const theme = useContext(ThemeContext);
  return (
    <LayoutRoot onClick={onErrorOpen} ref={ref}>
      {errors[0].length > 0 && (
        <Display>
          <FaExclamationCircle color={theme?.font.color.error} />
          <Count>{errors[0].length}</Count>
        </Display>
      )}
      {errors[1].length > 0 && (
        <Display>
          <FaExclamationTriangle color={theme?.font.color.warning} />
          <Count>{errors[1].length}</Count>
        </Display>
      )}
    </LayoutRoot>
  );
});
