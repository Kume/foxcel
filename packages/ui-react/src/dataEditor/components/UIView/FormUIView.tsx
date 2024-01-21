import React from 'react';
import {FormUIModel} from '@foxcel/core';
import {UIView, UIViewProps} from './UIView';
import styled from 'styled-components';
import {breakableTextStyle, labelTextStyle} from '../../../common/components/commonStyles';

const Table = styled.table`
  border-collapse: separate;
  border-color: ${({theme}) => theme.color.bg.normal};
  border-spacing: 4px 6px;
`;

const LabelCell = styled.td`
  ${({theme}) => labelTextStyle(theme)});
  background-color: ${({theme}) => theme.color.bg.label};
  padding: 0 6px;
  min-width: 80px;
  max-width: 160px;
  ${breakableTextStyle}
`;

export interface FormUIViewProps extends UIViewProps {
  readonly model: FormUIModel;
}

export const FormUIView: React.FC<FormUIViewProps> = ({model, ...otherProps}) => {
  return (
    <Table>
      <tbody>
        {model.contents.map((content, index) => {
          return (
            <tr key={index} style={{margin: 10}}>
              <LabelCell>{content.label}</LabelCell>
              <td>
                <UIView model={content.model} {...otherProps} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};
