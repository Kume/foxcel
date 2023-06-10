import styled from 'styled-components';
import {breakableTextStyle, inputTextStyle} from '../../common/components/commonStyles';

export const BackgroundTextarea = styled.textarea<{readonly isVisible: boolean}>`
  left: 0;
  top: 0;
  width: calc(100% - 8px);
  height: 100%;
  padding: 0 4px;
  overflow: hidden;
  position: absolute;
  opacity: ${({isVisible}) => (isVisible ? 1 : 0)};
  ${breakableTextStyle};

  background-color: transparent;
  ${({theme}) => inputTextStyle(theme)}

  border: none;
  resize: none;
  &:focus {
    outline: none;
  }
`;
