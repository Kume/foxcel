import {
  BooleanDataModel,
  DataModel,
  DataPointer,
  IntegerDataModel,
  ListDataModel,
  MapDataModel,
  NullDataModel,
  StringDataModel,
} from '../DataModel/DataModelTypes';
import {
  CheckBoxUISchema,
  ContentListUISchema,
  FormUISchema,
  MappingTableUISchema,
  NumberUISchema,
  SelectUISchema,
  TableUISchema,
  TabUISchema,
  TextUISchema,
} from './UISchemaTypes';
import {FilledTemplate} from '../DataModel/TemplateEngine';
import {UIDataFocusLogNode, UISchemaFocusLogNode} from './UIModelFocus';
import {SerializedDataModelContext} from '../DataModel/DataModelContext';

interface UIModelCommon {
  readonly dataContext: SerializedDataModelContext;
  readonly dataFocusLog: UIDataFocusLogNode | undefined;
  readonly schemaFocusLog: UISchemaFocusLogNode | undefined;
}

export interface TabUIModel extends UIModelCommon {
  readonly type: 'tab';
  readonly isKey?: void;
  readonly schema: TabUISchema;
  readonly data: MapDataModel | undefined;
  readonly currentTabIndex: number;
  readonly tabs: readonly TabUIModelTab[];
  readonly currentChild: UIModel | undefined;
}

export interface TabUIModelTab {
  readonly label: string;
  readonly dataContext: SerializedDataModelContext;
}

export interface FormUIModel extends UIModelCommon {
  readonly type: 'form';
  readonly isKey?: void;
  readonly schema: FormUISchema;
  readonly data: MapDataModel | undefined;
  readonly contents: readonly FormUIModelContent[];
}

export interface FormUIModelContent {
  readonly label: string;
  readonly model: UIModel;
}

interface KeyTextUIModel {
  readonly type: 'text';
  readonly isKey: true;
  readonly schema: TextUISchema;
  readonly dataContext: SerializedDataModelContext;
  readonly data?: undefined;
  readonly value: string | null;
}

interface StandardTextUIModel extends UIModelCommon {
  readonly type: 'text';
  readonly isKey?: void;
  readonly schema: TextUISchema;
  readonly data: StringDataModel | undefined;
  readonly value: StringDataModel | NullDataModel;
}

export type TextUIModel = KeyTextUIModel | StandardTextUIModel;

interface ContentListUIModelBase extends UIModelCommon {
  readonly type: 'contentList';
  readonly isKey?: void;
  readonly schema: ContentListUISchema;
  readonly data: MapDataModel | ListDataModel | undefined;
  readonly indexes: readonly ContentListIndex[];
}

interface EmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex?: undefined;
  readonly currentPointer?: undefined;
  readonly content?: undefined;
}

interface NonEmptyContentListUIModel extends ContentListUIModelBase {
  readonly currentIndex: number;
  readonly currentPointer: DataPointer;
  readonly content: UIModel;
}

export type ContentListUIModel = EmptyContentListUIModel | NonEmptyContentListUIModel;

export interface ContentListIndex {
  readonly label: FilledTemplate;
  readonly pointer: DataPointer;
  readonly dataContext: SerializedDataModelContext;
}

export interface TableUIModel extends UIModelCommon {
  readonly type: 'table';
  readonly isKey?: void;
  readonly schema: TableUISchema;
  readonly data: MapDataModel | ListDataModel | undefined;
  readonly columns: readonly TableUIModelColumn[];
  readonly rows: readonly TableUIModelRow[];
}

export interface TableUIModelColumn {
  readonly label: string;
}

export interface TableUIModelRow {
  readonly key: string | null | undefined;
  readonly uniqueKey: number | string;
  readonly data: MapDataModel | undefined;
  // TODO 現在使われてない。キャッシュを考慮したうえで使わないなら消す
  readonly dataFocusLog: UIDataFocusLogNode | undefined;
  readonly dataContext: SerializedDataModelContext;
  readonly cells: readonly UIModel[];
}

export interface MappingTableUIModel extends UIModelCommon {
  readonly type: 'mappingTable';
  readonly isKey?: void;
  readonly schema: MappingTableUISchema;
  readonly data: MapDataModel | undefined;
  readonly columns: readonly TableUIModelColumn[];
  readonly rows: readonly TableUIModelRow[];
  readonly danglingRows: readonly TableUIModelRow[];
}

export type MappingTableUIModelNotEmptyRow = TableUIModelRow & {isEmpty?: false};

export interface SelectUIModelCommon extends UIModelCommon {
  readonly type: 'select';
  readonly isKey?: void;
  readonly schema: SelectUISchema;
}

export interface SingleSelectUIModel extends SelectUIModelCommon {
  readonly isMulti?: false;
  readonly data: DataModel | undefined;
  readonly current?: SelectUIModelCurrentValue;
}

export interface MultiSelectUIModel extends SelectUIModelCommon {
  readonly isMulti: true;
  readonly data: ListDataModel | undefined;
  readonly currents: readonly (SelectUIModelCurrentValue & {readonly dataContext: SerializedDataModelContext})[];
}

export type SelectUIModel = SingleSelectUIModel | MultiSelectUIModel;

export interface ValidSelectUIModelCurrentValue {
  readonly isInvalid?: false;
  readonly label: string;
  readonly value: string;
  readonly data: DataModel;
}

export interface InvalidSelectUIModelCurrentValue {
  readonly isInvalid: true;
  readonly data: DataModel;
}

export type SelectUIModelCurrentValue = ValidSelectUIModelCurrentValue | InvalidSelectUIModelCurrentValue;

export interface CheckboxUIModel extends UIModelCommon {
  readonly type: 'checkbox';
  readonly isKey?: void;
  readonly schema: CheckBoxUISchema;
  readonly data: BooleanDataModel | undefined;
}

export interface NumberUIModel extends UIModelCommon {
  readonly type: 'number';
  readonly isKey?: void;
  readonly schema: NumberUISchema;
  readonly data: IntegerDataModel | undefined;
}

export type UIModel =
  | TabUIModel
  | FormUIModel
  | TextUIModel
  | ContentListUIModel
  | TableUIModel
  | MappingTableUIModel
  | SelectUIModel
  | CheckboxUIModel
  | NumberUIModel;

export type UIModelForType<Type extends UIModel['type'], Model = UIModel> = Model extends {type: Type} ? Model : never;
