import {DataModel, dataModelIsString, ForwardDataPath, stringDataModelToString, unknownToDataModel} from '..';
import {FormUISchema, TabUISchema, TextUISchema, UISchema} from './UISchema';
import {UIModelPathComponent} from './UIModelCommon';

export interface UIModelProps {
  readonly data: DataModel | undefined;
  readonly dataPath: ForwardDataPath;
  readonly modelPath: readonly UIModelPathComponent[];
  readonly key?: string | number;
}

export interface UIModelInterface<T> {
  readonly schema: T;
  readonly props: UIModelProps;
}

export interface SetDataUIModelAction {
  type: 'setData';
  path: ForwardDataPath;
  data: DataModel;
}

export interface DeleteDataUIModelAction {
  type: 'deleteData';
  path: ForwardDataPath;
}

export type UIModelAction = SetDataUIModelAction | DeleteDataUIModelAction;

export function createUIModel(schema: UISchema, props: UIModelProps): UIModel {
  switch (schema.type) {
    case 'tab':
      return new TabUIModel(schema, props);
    case 'form':
      return new FormUIModel(schema, props);
    case 'text':
      return new TextUIModel(schema, props);
    default:
      throw new Error(); // TODO defaultを書かなくても良いように
  }
}

class TabUIModel implements UIModelInterface<TabUISchema> {
  public constructor(public readonly schema: TabUISchema, public readonly props: UIModelProps) {}
}

class FormUIModel implements UIModelInterface<FormUISchema> {
  public constructor(public readonly schema: FormUISchema, public readonly props: UIModelProps) {}
}

class TextUIModel implements UIModelInterface<TextUISchema> {
  public constructor(public readonly schema: TextUISchema, public readonly props: UIModelProps) {}

  public value(): string {
    const {data} = this.props;
    if (data !== undefined && dataModelIsString(data)) {
      return stringDataModelToString(data);
    } else {
      return '';
    }
  }

  public input(value: string): readonly UIModelAction[] {
    return value === this.value()
      ? []
      : [{type: 'setData', path: this.props.dataPath, data: unknownToDataModel(value)}];
  }
}

export type UIModel = TabUIModel | FormUIModel | TextUIModel;
