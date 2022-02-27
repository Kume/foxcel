import styled from 'styled-components';

export const TextareaForTableCell = styled.textarea<{readonly isVisible: boolean}>`
  left: 0;
  top: 0;
  width: calc(100% - 8px);
  height: 100%;
  padding: 0 4px;
  overflow: hidden;
  position: absolute;
  opacity: ${({isVisible}) => (isVisible ? 1 : 0)};

  background-color: transparent;
  font-size: var(--basic-font-size);
  // TODO ちゃんとフォントをセットする
  font-family: meiryo;

  border: none;
  &:focus {
    outline: none;
  }
`;
