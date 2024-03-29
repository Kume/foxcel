import {UISchemaExcludeRecursive, uiSchemaKeyIsParentKey} from './UISchema';
import {UISchema, UISchemaOrRecursive} from './UISchemaTypes';
import {
  dataPathComponentIsKey,
  dataPathComponentIsMapKeyLike,
  dataPathComponentIsPointer,
  dataPathComponentToMapKey,
  EditingForwardDataPathComponent,
  ForwardDataPathComponent,
} from '../DataModel/DataPath';
import {DataModel} from '../DataModel/DataModelTypes';
import {dataModelIsMap, getMapDataIndexForPointer, getMapKeyAtIndex, PathContainer} from '../DataModel/DataModel';
import {validIndexOrUndefined} from '../common/utils';

export class UISchemaContext {
  public static createRootContext(rootSchema: UISchema): UISchemaContext {
    return new UISchemaContext(rootSchema, rootSchema, []);
  }

  private constructor(
    public readonly rootSchema: UISchema,
    public readonly currentSchema: UISchemaExcludeRecursive,
    private readonly path: readonly UISchema[],
  ) {}

  public resolve(schema: UISchemaOrRecursive): UISchema {
    if (schema.type === 'recursive') {
      if (schema.depth > this.path.length) {
        throw new Error('Invalid ui schema depth');
      }
      return {...this.path[this.path.length - (schema.depth - 1)], key: schema.key};
    } else {
      return schema;
    }
  }

  public get dataContextKey(): string | undefined {
    return this.currentSchema.dataSchema.contextKey;
  }

  public digForIndex(index: number): UISchemaContext {
    switch (this.currentSchema.type) {
      case 'tab':
      case 'table':
      case 'mappingTable':
      case 'form': {
        if (index >= this.currentSchema.contents.length) {
          throw new Error('Invalid content index');
        }
        if (this._contents?.[index]) {
          return this._contents[index];
        }
        const content = this.resolve(this.currentSchema.contents[index]);
        const nextPath = [...this.path, this.currentSchema];
        return new UISchemaContext(this.rootSchema, content, nextPath);
      }

      default:
        throw new Error(`Cannot dig schema ${this.currentSchema.type} for index.`);
    }
  }

  public contentsIndexForKey(key: string | null | undefined): number | undefined {
    return validIndexOrUndefined(this.contents().findIndex(({currentSchema: {key: contentKey}}) => contentKey === key));
  }

  private _contents?: readonly UISchemaContext[];
  public contents(): readonly UISchemaContext[] {
    if (this._contents) {
      return this._contents;
    }
    switch (this.currentSchema.type) {
      case 'tab':
      case 'form':
      case 'table':
      case 'mappingTable':
        this._contents = this.currentSchema.contents.map((content, index) => {
          return this.digForIndex(index);
        });
        break;

      default:
        throw new Error(`cannot get contents from ${this.currentSchema.type} ui schema`);
    }
    return this._contents;
  }

  private _content?: UISchemaContext;
  public content(): UISchemaContext {
    if (this._content) {
      return this._content;
    }
    switch (this.currentSchema.type) {
      case 'contentList': {
        const content = this.resolve(this.currentSchema.content);
        return (this._content = new UISchemaContext(this.rootSchema, content, [...this.path, this.currentSchema]));
      }

      default:
        throw new Error(`cannot get content from ${this.currentSchema.type} ui schema`);
    }
  }

  public conditionalContentForKey(key: string | undefined): UISchemaContext {
    switch (this.currentSchema.type) {
      case 'conditional': {
        const content = this.resolve(
          key === undefined ? this.currentSchema.defaultContent : this.currentSchema.contents[key],
        );
        return (this._content = new UISchemaContext(this.rootSchema, content, [...this.path, this.currentSchema]));
      }

      default:
        throw new Error(`current schema is not conditional. (${this.currentSchema.type})`);
    }
  }

  public childIndexForDataPath(pathComponent: ForwardDataPathComponent): number | undefined {
    switch (this.currentSchema.type) {
      case 'tab':
        if (dataPathComponentIsMapKeyLike(pathComponent)) {
          const key = dataPathComponentToMapKey(pathComponent);
        } else if (dataPathComponentIsKey(pathComponent)) {
          // TODO
        }
        return undefined;
    }

    return undefined;
  }
}
