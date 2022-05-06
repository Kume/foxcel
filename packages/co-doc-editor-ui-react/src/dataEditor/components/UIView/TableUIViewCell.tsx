import React from 'react';
import {AppAction} from 'co-doc-editor-core/dist/App/AppState';
import {DataModelContext, DataModelRoot} from 'co-doc-editor-core/dist/DataModel/DataModelContext';
import {DataModel} from 'co-doc-editor-core';

export interface TableCellCallbacks {
  readonly onAction: (action: AppAction) => void;
  readonly getRoot: () => DataModelRoot;
  readonly onMouseDown: (e: React.MouseEvent, row: number, column: number) => void;
  readonly onMouseOver: (e: React.MouseEvent, row: number, column: number) => void;
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
  readonly dataContext: DataModelContext;
  readonly onEdit: (model: DataModel) => void;
}

export type ModelOrSchemaHolder<Model, Schema> =
  | {readonly model: Model; readonly schema?: undefined}
  | {readonly model?: undefined; readonly schema: TableUIViewCellSchemaInfo<Schema>};
