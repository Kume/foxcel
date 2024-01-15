import {UIView, UIViewProps} from './UIView';
import styled from 'styled-components';
import React from 'react';
import {TabUIModel} from '@foxcel/core/dist/UIModel/UIModelTypes';
import {labelTextStyle} from '../../../common/components/commonStyles';

const LayoutRoot = styled.div``;

const TabArea = styled.div`
  display: flex;
`;

const Tab = styled.div<{selected: boolean}>`
  min-width: 80px;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin-left: 0.2rem;
  border: 1px solid ${({theme}) => theme.color.border.tab};
  ${({theme}) => labelTextStyle(theme)}
  position: relative;
  bottom: -1px;
  white-space: nowrap;
  ${({selected, theme}) =>
    selected
      ? `
        background-color: ${theme.color.bg.normal};
        border-bottom: 0;
      `
      : `
        background-color: ${theme.color.bg.inactiveTab};
      `}
`;

const ContentArea = styled.div`
  padding: 8px;
  border-top: 1px solid ${({theme}) => theme.color.border.tab};
`;

export interface TabUIViewProps extends UIViewProps {
  readonly model: TabUIModel;
}

export const TabUIView: React.FC<TabUIViewProps> = ({model, ...otherProps}) => {
  return (
    <LayoutRoot>
      <TabArea>
        {model.tabs.map(({label, dataContext}, index) => (
          <Tab
            selected={model.currentTabIndex === index}
            key={index}
            onClick={() => otherProps.onAction({type: 'focus', dataContext})}>
            {label}
          </Tab>
        ))}
      </TabArea>
      {model.currentChild && (
        <ContentArea>
          <UIView model={model.currentChild} {...otherProps} />
        </ContentArea>
      )}
    </LayoutRoot>
  );
};
