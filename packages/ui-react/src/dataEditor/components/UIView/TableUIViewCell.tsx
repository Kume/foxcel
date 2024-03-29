import React from 'react';
import {AppAction, DataModel, DataModelRoot, SerializedDataModelContext} from '@foxcel/core';

export interface TableCellCallbacks {
  readonly onAction: (action: AppAction | undefined) => void;
  readonly getRoot: () => DataModelRoot;
  readonly onMouseDown: (e: React.MouseEvent, row: number | undefined, column: number | undefined) => void;
  readonly onMouseOver: (e: React.MouseEvent, row: number | undefined, column: number | undefined) => void;
  readonly onKeyDown: (e: KeyboardEvent | React.KeyboardEvent, isEditing: boolean) => boolean;
}

export interface TableUIViewCellProps {
  readonly isMainSelected: boolean;
  readonly row: number;
  readonly col: number;
  readonly callbacks: TableCellCallbacks;
  readonly disabled?: boolean;
}

export interface TableUIViewCellSchemaInfo<Schema> {
  readonly schema: Schema;
  readonly dataContext: SerializedDataModelContext;
  readonly onEdit: (model: DataModel) => void;
}
