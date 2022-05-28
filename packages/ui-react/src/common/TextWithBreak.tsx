import React, {useMemo} from 'react';
import styled from 'styled-components';
import {breakableTextStyle, inputTextStyle} from './components/commonStyles';

const Line = styled.p`
  ${({theme}) => inputTextStyle(theme)}
  ${breakableTextStyle}
  margin: 0;
  max-width: 400px;
`;

export const TextWithBreak: React.FC<{readonly text: string}> = ({text}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  return (
    <>
      {lines.map((line, index) => (
        <Line key={index}>{line || '　'}</Line>
      ))}
    </>
  );
};
