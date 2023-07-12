import {UISchemaExcludeRecursive} from '@foxcel/core/dist/UIModel/UISchema';
import {DataSchemaExcludeRecursive} from '@foxcel/core/dist/DataModel/DataSchema';
import {DataModel} from '@foxcel/core';
import {AppAction} from '@foxcel/core/dist/App/AppState';

export interface LoadedData {
  readonly uiSchema: UISchemaExcludeRecursive;
  readonly dataSchema: DataSchemaExcludeRecursive;
  readonly data: DataModel | undefined;
  readonly restoredActions?: AppAction[];
}

export interface FontSizeTheme {
  readonly label: string;
  readonly input: string;
}

export interface FontFamilyTheme {
  readonly label: string;
  readonly input: string;
}

export interface FontColorTheme {
  readonly label: string;
  readonly input: string;
  readonly popup: string;
  readonly placeholder: string;
  readonly itemSelection: string;
}

export interface BgColorTheme {
  readonly normal: string;
  readonly active: string;
  readonly label: string;
  readonly inactiveTab: string;
  readonly input: string;
  readonly popup: string;
  readonly itemHover: string;
  readonly itemSelection: string;
}

export interface Theme {
  readonly font: {
    readonly size: FontSizeTheme;
    readonly family: FontFamilyTheme;
    readonly color: FontColorTheme;
  };

  readonly color: {
    readonly bg: BgColorTheme;
    readonly border: {
      readonly inputFocus: string;
      readonly input: string;
      readonly popup: string;
      readonly tab: string;
      readonly list: string;
      readonly table: string;
    };
  };
}

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface DefaultTheme extends Theme {}
}
