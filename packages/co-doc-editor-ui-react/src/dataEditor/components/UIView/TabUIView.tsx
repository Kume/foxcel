import {UIView, UIViewProps} from './UIView';
import styled from 'styled-components';
import React from 'react';
import {TabUIModel} from 'co-doc-editor-core/dist/UIModel/UIModelTypes';

const LayoutRoot = styled.div``;

const TabArea = styled.div`
  display: flex;
`;

const Tab = styled.div<{selected: boolean}>`
  min-width: 80px;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin-left: 0.2rem;
  border: 1px solid gray;
  background-color: lightgray;
  position: relative;
  bottom: -1px;
  white-space: nowrap;
  ${({selected}) =>
    selected
      ? `
        background-color: white;
        border-bottom: 0;
      `
      : ''}
`;

const ContentArea = styled.div`
  padding: 8px;
  border-top: 1px solid gray;
`;

export interface TabUIViewProps extends UIViewProps {
  readonly model: TabUIModel;
}

export const TabUIView: React.FC<TabUIViewProps> = ({model, ...otherProps}) => {
  return (
    <LayoutRoot>
      <TabArea>
        {model.tabs.map(({label, dataPath}, index) => (
          <Tab
            selected={model.currentTabIndex === index}
            key={index}
            onClick={() => otherProps.onAction({type: 'focus', path: dataPath})}
          >
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
