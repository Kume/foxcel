import React, {useMemo} from 'react';
import styled from 'styled-components';
import {breakableTextStyle, inputTextStyle} from './components/commonStyles';

const Line = styled.p`
  ${({theme}) => inputTextStyle(theme)}
  ${breakableTextStyle}
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
        <Line key={index} style={{opacity: hidden ? 0 : 1}}>
          {line || '　'}
        </Line>
      ))}
    </>
  );
};
