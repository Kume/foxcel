import React from 'react';
import {FormUIModel} from '@foxcel/core/dist/UIModel/UIModelTypes';
import {UIView, UIViewProps} from './UIView';
import styled from 'styled-components';
import {breakableTextStyle, labelTextStyle} from '../../../common/components/commonStyles';

const Table = styled.table``;

const LabelCell = styled.td`
  ${({theme}) => labelTextStyle(theme)});
  background-color: ${({theme}) => theme.color.bg.label};
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
            <tr key={index}>
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
