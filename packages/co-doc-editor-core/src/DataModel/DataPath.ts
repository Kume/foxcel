import {DataModelOperationError} from './errors';
import parser, {ParsedPath} from './DataPath/DataPathParser';
import {ShallowWritable} from '../common/utilTypes';

export enum DataPathComponentType {
  IndexOrKey,
  WildCard,
  Nested,
  Reverse,
  ContextKey,
  Union,
  Key,
  Pointer,
}

export type KeyPathComponent = {
  readonly t: DataPathComponentType.Key;
};
export type PointerPathComponent = {
  readonly t: DataPathComponentType.Pointer;
  readonly i: number;
  readonly d: number;
};

export type ForwardDataPathComponent =
  | string
  | number
  | IndexOrKeyDataPathComponent
  | KeyPathComponent
  | PointerPathComponent;
export type ForwardDataPathComponentExcludingKey = string | number | IndexOrKeyDataPathComponent;

export type IndexOrKeyDataPathComponent = {
  readonly t: DataPathComponentType.IndexOrKey;
  readonly v: number;
};
export type WildCardPathComponent = {
  readonly t: DataPathComponentType.WildCard;
};
export type NestedPathComponent = {
  readonly t: DataPathComponentType.Nested;
  readonly v: DataPath;
};
export type MultiNestedPathComponent = {
  readonly t: DataPathComponentType.Nested;
  readonly v: MultiDataPath;
};
export type ReversePathComponent = {
  readonly t: DataPathComponentType.Reverse;
};
export type ContextKeyPathComponent = {
  readonly t: DataPathComponentType.ContextKey;
  readonly v: string;
};
export type UnionPathComponent = {
  readonly t: DataPathComponentType.Union;
  readonly v: readonly ForwardDataPathComponent[];
};
export type DataPathComponent =
  | ForwardDataPathComponent
  | ReversePathComponent
  | ContextKeyPathComponent
  | NestedPathComponent;
export type MultiDataPathComponent =
  | ForwardDataPathComponent
  | WildCardPathComponent
  | MultiNestedPathComponent
  | ReversePathComponent
  | ContextKeyPathComponent
  | UnionPathComponent;

type AnyDataPath = ForwardDataPath | DataPath | MultiDataPath;

export type ForwardDataPath = {
  readonly isAbsolute?: false;
  readonly components: readonly ForwardDataPathComponent[];
};

export type DataPath = {
  readonly isAbsolute?: boolean;
  readonly components: readonly DataPathComponent[];
};

export type MultiDataPath = {
  readonly isAbsolute?: boolean;
  readonly components: readonly MultiDataPathComponent[];
};

export const keyDataPathComponent: KeyPathComponent = {t: DataPathComponentType.Key};
export const emptyDataPath = {components: []} as const;

export function dataPathComponentIsListIndexLike(
  component: MultiDataPathComponent,
): component is number | IndexOrKeyDataPathComponent {
  return typeof component === 'number' || dataPathComponentIsIndexOrKey(component);
}

export function pathComponentToListIndex(component: IndexOrKeyDataPathComponent | number): number {
  return typeof component === 'number' ? component : component.v;
}

export function dataPathComponentIsMapKey(key: ForwardDataPathComponent): key is string {
  return typeof key === 'string';
}

export function dataPathComponentToMapKey(key: string | IndexOrKeyDataPathComponent): string {
  return typeof key === 'string' ? key : key.v.toString(10);
}

export function dataPathComponentIsListIndex(key: ForwardDataPathComponent): key is number {
  return typeof key === 'number';
}

export function dataPathComponentIsMapKeyLike(
  component: MultiDataPathComponent,
): component is string | IndexOrKeyDataPathComponent {
  return typeof component === 'string' || dataPathComponentIsIndexOrKey(component);
}

export function dataPathComponentIsIndexOrKey(
  component: MultiDataPathComponent,
): component is IndexOrKeyDataPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.IndexOrKey;
}

export function dataPathComponentIsPointer(component: MultiDataPathComponent): component is PointerPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.Pointer;
}

export function forwardDataPathComponentToNumberOrString(
  component: ForwardDataPathComponentExcludingKey,
): number | string {
  switch (typeof component) {
    case 'number':
    case 'string':
      return component;
    default:
      return component.v;
  }
}

export function forwardDataPathComponentToString(component: ForwardDataPathComponentExcludingKey): string {
  switch (typeof component) {
    case 'number':
      return component.toString(10);
    case 'string':
      return component;
    default:
      return component.v.toString(10);
  }
}

export function dataPathComponentIsKey(component: MultiDataPathComponent): component is KeyPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.Key;
}

export function getListIndexFromDataPathElement(component: number | IndexOrKeyDataPathComponent): number {
  return typeof component === 'number' ? component : component.v;
}

export function getListIndexFromDataPathElementOrFail(component: ForwardDataPathComponent): number {
  if (dataPathComponentIsListIndexLike(component)) {
    return getListIndexFromDataPathElement(component);
  } else {
    throw new DataModelOperationError('Only can get value from list by index like path component.');
  }
}

export function getMapKeyFromDataPathElement(component: string | IndexOrKeyDataPathComponent): string {
  return typeof component === 'string' ? component : component.v.toString();
}

export function getMapKeyFromDataPathElementOrFail(component: MultiDataPathComponent): string {
  if (dataPathComponentIsMapKeyLike(component)) {
    return getMapKeyFromDataPathElement(component);
  } else {
    throw new DataModelOperationError('Only can get value from map by key like path component.');
  }
}

function copyPathOption(source: MultiDataPath, dist: ShallowWritable<MultiDataPath>): void {
  if (source.isAbsolute) {
    dist.isAbsolute = true;
  }
}

export function headDataPathComponent(path: ForwardDataPath): ForwardDataPathComponent;
export function headDataPathComponent(path: DataPath): DataPathComponent;
export function headDataPathComponent(path: MultiDataPath): MultiDataPathComponent;
export function headDataPathComponent(path: MultiDataPath): MultiDataPathComponent {
  if (!path.components[0]) {
    throw new Error('Cannot get first path component of empty path');
  }
  return path.components[0];
}

export function headDataPathComponentOrUndefined(path: ForwardDataPath): ForwardDataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: DataPath): DataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: MultiDataPath): MultiDataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: MultiDataPath): MultiDataPathComponent | undefined {
  return path.components[0];
}

export function tailDataPathComponent(path: ForwardDataPath): ForwardDataPathComponent;
export function tailDataPathComponent(path: DataPath): DataPathComponent;
export function tailDataPathComponent(path: MultiDataPath): MultiDataPathComponent;
export function tailDataPathComponent(path: MultiDataPath): MultiDataPathComponent {
  if (!path.components[path.components.length - 1]) {
    throw new Error('Cannot get first path component of empty path');
  }
  return path.components[path.components.length - 1];
}

export function popDataPath(path: ForwardDataPath): ForwardDataPath;
export function popDataPath(path: DataPath): DataPath;
export function popDataPath(path: MultiDataPath): MultiDataPath;
export function popDataPath(path: AnyDataPath): AnyDataPath {
  return {
    isAbsolute: path.isAbsolute,
    components: path.components.slice(0, path.components.length - 1),
  };
}

export function pushDataPath(path: ForwardDataPath, component: ForwardDataPathComponent): ForwardDataPath;
export function pushDataPath(path: DataPath, component: ForwardDataPathComponent): DataPath;
export function pushDataPath(path: MultiDataPath, component: ForwardDataPathComponent): MultiDataPath;
export function pushDataPath(path: AnyDataPath, component: ForwardDataPathComponent): AnyDataPath {
  if (dataPathLength(path) > 0 && dataPathComponentIsKey(dataPathLastComponent(path))) {
    throw new Error('Cannot push to points key path.');
  }
  return {
    isAbsolute: path.isAbsolute,
    components: [...path.components, component],
  };
}

export function shiftDataPath(path: ForwardDataPath): ForwardDataPath;
export function shiftDataPath(path: DataPath): DataPath;
export function shiftDataPath(path: MultiDataPath): MultiDataPath;
export function shiftDataPath(path: AnyDataPath): AnyDataPath {
  // Don't copy isAbsolute.
  return {components: path.components.slice(1, path.components.length)};
}

export function unshiftDataPath(path: ForwardDataPath, component: ForwardDataPathComponent): ForwardDataPath;
export function unshiftDataPath(path: DataPath, component: ForwardDataPathComponent): DataPath;
export function unshiftDataPath(path: MultiDataPath, component: ForwardDataPathComponent): MultiDataPath;
export function unshiftDataPath(path: AnyDataPath, component: ForwardDataPathComponent): AnyDataPath {
  if (path.isAbsolute) {
    throw new Error('Cannot unshift to absolute path.');
  }
  if (dataPathComponentIsKey(component) && path.components.length > 0) {
    throw new Error('Cannot unshift point path component.');
  }
  return {components: [component, ...path.components]};
}

export function dataPathLength(path: MultiDataPath): number {
  return path.components.length;
}

export function dataPathLastComponent(path: ForwardDataPath): ForwardDataPathComponent;
export function dataPathLastComponent(path: DataPath): DataPathComponent;
export function dataPathLastComponent(path: MultiDataPath): MultiDataPathComponent;
export function dataPathLastComponent(path: AnyDataPath): MultiDataPathComponent {
  if (dataPathLength(path) === 0) {
    throw new Error('Data path is empty');
  }
  return path.components[dataPathLength(path) - 1];
}

export function dataPathFirstComponent(path: ForwardDataPath): ForwardDataPathComponent;
export function dataPathFirstComponent(path: DataPath): DataPathComponent;
export function dataPathFirstComponent(path: MultiDataPath): MultiDataPathComponent;
export function dataPathFirstComponent(path: AnyDataPath): MultiDataPathComponent {
  if (dataPathLength(path) === 0) {
    throw new Error('Data path is empty');
  }
  return path.components[0];
}

export function dataPathFirstComponentOrUndefined(
  path: ForwardDataPath | undefined,
): ForwardDataPathComponent | undefined;
export function dataPathFirstComponentOrUndefined(path: DataPath | undefined): DataPathComponent | undefined;
export function dataPathFirstComponentOrUndefined(path: MultiDataPath | undefined): MultiDataPathComponent | undefined;
export function dataPathFirstComponentOrUndefined(path: AnyDataPath | undefined): MultiDataPathComponent | undefined {
  if (path === undefined || dataPathLength(path) === 0) {
    return undefined;
  }
  return path.components[0];
}

function parsedPathToDataPath(parsed: ParsedPath, pathType: 'forward' | 'single' | undefined): MultiDataPath {
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  const isAbsolute = typeof first !== 'string' && first.type === 'absolute';
  const pointsKey = typeof last !== 'string' && last.type === 'key';

  const components: MultiDataPathComponent[] = [];
  parsed.forEach((parsedComponent) => {
    if (typeof parsedComponent === 'string') {
      const asNumber = Number(parsedComponent);
      if (Number.isInteger(asNumber)) {
        components.push({t: DataPathComponentType.IndexOrKey, v: asNumber});
      } else {
        components.push(parsedComponent);
      }
    } else {
      switch (parsedComponent.type) {
        case 'parent':
          if (pathType === 'forward') {
            throw new Error(`${pathType} path cannot contain parent.`);
          }
          components.push({t: DataPathComponentType.Reverse});
          break;
        case 'context':
          if (pathType === 'forward') {
            throw new Error(`${pathType} path cannot contain context.`);
          }
          components.push({t: DataPathComponentType.ContextKey, v: parsedComponent.key});
          break;
        case 'wildcard':
          if (pathType) {
            throw new Error(`${pathType} path cannot contain wildcard.`);
          }
          components.push({t: DataPathComponentType.WildCard});
          break;
        case 'variable':
          if (pathType === 'forward') {
            throw new Error(`${pathType} path cannot contain variable.`);
          }
          components.push({t: DataPathComponentType.Nested, v: parsedPathToDataPath(parsedComponent.path, pathType)});
          break;
      }
    }
  });

  if (pointsKey) {
    components.push({t: DataPathComponentType.Key});
  }
  const path: ShallowWritable<MultiDataPath> = {components};
  if (isAbsolute) {
    path.isAbsolute = true;
  }
  return path;
}

export function parsePath(source: string, pathType: 'single'): DataPath;
export function parsePath(source: string, pathType: 'forward'): ForwardDataPath;
export function parsePath(source: string): MultiDataPath;
export function parsePath(source: string, pathType?: 'forward' | 'single'): MultiDataPath {
  const parsed = parser.parse(source);
  if (parsed.length === 0) {
    throw new Error(`invalid path value ${source}`);
  }

  return parsedPathToDataPath(parsed, pathType);
}
