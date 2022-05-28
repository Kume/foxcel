import {Theme} from '../../types';

export function labelTextStyle(theme: Theme): string {
  return `
  font-size: ${theme.font.size.label};
  font-family: ${theme.font.family.label};
  color: ${theme.font.color.label};
  `;
}

export function inputTextStyle(theme: Theme): string {
  return `
  font-size: ${theme.font.size.input};
  font-family: ${theme.font.family.input};
  color: ${theme.font.color.input};
  `;
}

export const breakableTextStyle = `
  overflow-wrap: break-word;
  word-break: keep-all;
`;
