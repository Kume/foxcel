import {UISchemaExcludeRecursive, uiSchemaKeyIsParentKey} from './UISchema';
import {UISchema} from './UISchemaTypes';
import {
  dataPathComponentIsKey,
  dataPathComponentIsMapKeyLike,
  dataPathComponentIsPointer,
  dataPathComponentToMapKey,
  ForwardDataPath,
  ForwardDataPathComponent,
  tailDataPathComponent,
} from '../DataModel/DataPath';
import {DataModel} from '../DataModel/DataModelTypes';
import {
  dataModelIsMap,
  dataPathComponentToStringDataModel,
  getMapDataAt,
  getMapDataIndexForPointer,
  getMapKeyAtIndex,
} from '../DataModel/DataModel';
import {validIndexOrUndefined} from '../common/utils';
import {uiSchemaKeyToDataPathComponent} from './DataPathContext';

export class UISchemaContext {
  public static createRootContext(rootSchema: UISchemaExcludeRecursive): UISchemaContext {
    return new UISchemaContext(rootSchema, rootSchema, []);
  }

  private constructor(
    public readonly rootSchema: UISchemaExcludeRecursive,
    public readonly currentSchema: UISchemaExcludeRecursive,
    private readonly path: readonly UISchemaExcludeRecursive[],
  ) {}

  private resolve(schema: UISchema): UISchemaExcludeRecursive {
    if (schema.type === 'recursive') {
      if (schema.depth >= this.path.length) {
        throw new Error('Invalid ui schema depth');
      }
      return this.path[this.path.length - schema.depth - 1];
    } else {
      return schema;
    }
  }

  public digForIndex(index: number): UISchemaContext {
    switch (this.currentSchema.type) {
      case 'tab':
      case 'table':
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
    dataPathComponent: ForwardDataPathComponent | undefined,
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

  public getDataFromParentData(
    parentData: DataModel | undefined,
    dataPath: ForwardDataPath,
  ): {model: DataModel | undefined; pathComponent?: ForwardDataPathComponent} {
    // TODO tabやformなどのfixedMapのみで利用できるメソッドであるため、それと分かる様な名前にするべきかも

    if (this.currentSchema.keyFlatten) {
      return {model: parentData};
    } else {
      const key = this.currentSchema.key;
      if (key === undefined) {
        throw new Error('content must have key or keyFlatten');
      }

      const nextPathComponent = uiSchemaKeyToDataPathComponent(key);
      if (dataModelIsMap(parentData)) {
        if (uiSchemaKeyIsParentKey(key)) {
          return {
            model: dataPathComponentToStringDataModel(tailDataPathComponent(dataPath)),
            pathComponent: nextPathComponent,
          };
        } else {
          return {model: getMapDataAt(parentData, key), pathComponent: nextPathComponent};
        }
      }

      return {model: undefined, pathComponent: nextPathComponent};
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
