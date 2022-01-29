import React, {useMemo} from 'react';

export const TextWithBreak: React.FC<{readonly text: string}> = ({text}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line || '　'}
          {index !== lines.length - 1 ? <br /> : undefined}
        </React.Fragment>
      ))}
    </>
  );
};
