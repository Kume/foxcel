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
import {dataModelIsMap, getMapDataIndexForPointer, getMapKeyAtIndex} from '../DataModel/DataModel';
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

  public contentIndexForDataPathComponent(
    dataPathComponent: EditingForwardDataPathComponent | undefined,
    currentData: DataModel | undefined,
  ): number | undefined {
    if (dataPathComponent === undefined) {
      return undefined;
    }
    // TODO keyFlattenの考慮
    let contents: readonly UISchemaContext[];
    switch (this.currentSchema.type) {
      case 'tab':
      case 'form':
        contents = this.contents();
        break;

      default:
        return undefined;
    }
    if (dataPathComponentIsKey(dataPathComponent)) {
      return validIndexOrUndefined(
        contents.findIndex(({currentSchema: {key}}) => key !== undefined && uiSchemaKeyIsParentKey(key)),
      );
    }

    let key: string;
    if (dataPathComponentIsPointer(dataPathComponent)) {
      if (currentData && dataModelIsMap(currentData)) {
        const index = getMapDataIndexForPointer(currentData, dataPathComponent);
        if (index === undefined) {
          return undefined;
        }
        const key_ = getMapKeyAtIndex(currentData, index);
        if (typeof key_ !== 'string') {
          return undefined;
        }
        key = key_;
      } else {
        return undefined;
      }
    } else if (dataPathComponentIsMapKeyLike(dataPathComponent)) {
      key = dataPathComponentToMapKey(dataPathComponent);
    } else {
      return undefined;
    }
    return validIndexOrUndefined(contents.findIndex(({currentSchema: {key: contentKey}}) => contentKey === key));
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
        return new UISchemaContext(this.rootSchema, content, [...this.path, this.currentSchema]);
      }

      default:
        throw new Error(`cannot get content from ${this.currentSchema.type} ui schema`);
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
