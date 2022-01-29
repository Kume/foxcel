import React from 'react';
import {FormUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';
import {UIView, UIViewProps} from './UIView';
import styled from 'styled-components';

const Table = styled.table``;

const LabelCell = styled.td`
  font-size: var(--basic-font-size);
  background-color: lightgray;
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
