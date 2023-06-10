import React, {useMemo} from 'react';
import styled from 'styled-components';
import {breakableTextStyle, inputTextStyle} from './components/commonStyles';

const Line = styled.p<{readonly isVisible: boolean}>`
  ${({theme}) => inputTextStyle(theme)}
  ${breakableTextStyle}
  // opacity: ${({isVisible}) => (isVisible ? 1 : 0)};
  margin: 0;
  max-width: 400px;
`;

interface Props {
  readonly text: string;
  readonly hidden?: boolean;
}

export const TextWithBreak: React.FC<Props> = ({text, hidden}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  return (
    <>
      {lines.map((line, index) => (
        <Line key={index} isVisible={!hidden}>
          {line || '　'}
        </Line>
      ))}
    </>
  );
};
