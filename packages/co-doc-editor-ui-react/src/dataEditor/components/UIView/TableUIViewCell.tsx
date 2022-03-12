import React from 'react';
import {AppAction} from 'co-doc-editor-core/dist/App/AppState';
import {DataModelRoot} from 'co-doc-editor-core/dist/DataModel/DataModelContext';

export interface TableCellCallbacks {
  readonly onAction: (action: AppAction) => void;
  readonly getRoot: () => DataModelRoot;
  readonly onMouseDown: (e: React.MouseEvent, row: number, column: number) => void;
  readonly onMouseOver: (e: React.MouseEvent, row: number, column: number) => void;
  readonly onDoubleClick: (e: React.MouseEvent, row: number, column: number) => void;
}

export interface TableUIViewCellProps {
  readonly isMainSelected: boolean;
  readonly row: number;
  readonly col: number;
  readonly callbacks: TableCellCallbacks;
}
