import {DataModelOperationError} from './errors';
import type {ParsedPath} from './DataPath/DataPathParser';
import {parse} from './DataPath/DataPathParser';
import {DataPointer} from './DataModelTypes';
import {getIdFromDataPointer} from './DataModel';

export enum DataPathComponentType {
  IndexOrKey,
  WildCard,
  Nested,
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

export type ListIndexDataPathComponent = number;
export type MapKeyDataPathComponent = string;

export type SerializableForwardDataPathComponent =
  | MapKeyDataPathComponent
  | ListIndexDataPathComponent
  | IndexOrKeyDataPathComponent;
// export type ForwardDataPathComponent = SerializableForwardDataPathComponent | PointerPathComponent;
export type ForwardDataPathComponent = SerializableForwardDataPathComponent;
export type EditingForwardDataPathComponent = SerializableForwardDataPathComponent | PointerPathComponent;

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
export type UnionPathComponent = {
  readonly t: DataPathComponentType.Union;
  readonly v: readonly ForwardDataPathComponent[];
};
export type DataPathComponent = ForwardDataPathComponent | KeyPathComponent | NestedPathComponent;
export type MultiDataPathComponent =
  | ForwardDataPathComponent
  | KeyPathComponent
  | WildCardPathComponent
  | MultiNestedPathComponent
  | UnionPathComponent;

export type AnyDataPathComponent = MultiDataPathComponent | PointerPathComponent;

export type AnyDataPath = ForwardDataPath | DataPath | MultiDataPath | EditingForwardDataPath;

export type ForwardDataPath = {
  readonly isAbsolute?: false;
  /**
   * reverse count
   */
  readonly r?: never;
  /**
   * context key
   */
  readonly ctx?: never;
  readonly components: readonly ForwardDataPathComponent[];
};

export type EditingForwardDataPath = {
  readonly isAbsolute?: false;
  /**
   * reverse count
   */
  readonly r?: never;
  /**
   * context key
   */
  readonly ctx?: never;
  readonly components: readonly EditingForwardDataPathComponent[];
};

export type DataPath = {
  readonly isAbsolute?: boolean;
  /**
   * reverse count
   */
  readonly r?: number;
  /**
   * context key
   */
  readonly ctx?: string;
  readonly components: readonly DataPathComponent[];
};

export type MultiDataPath = {
  readonly isAbsolute?: boolean;
  /**
   * reverse count
   */
  readonly r?: number;
  /**
   * context key
   */
  readonly ctx?: string;
  readonly components: readonly MultiDataPathComponent[];
};

export type DataPathToComponentType<T extends AnyDataPath> = T extends {readonly components: readonly (infer C)[]}
  ? C
  : never;

export const keyDataPathComponent: KeyPathComponent = {t: DataPathComponentType.Key};
export const emptyDataPath = {components: []} as const;

export function dataPathComponentIsListIndexLike(
  component: AnyDataPathComponent,
): component is number | IndexOrKeyDataPathComponent {
  return typeof component === 'number' || dataPathComponentIsIndexOrKey(component);
}

export function dataPathComponentIsMapKey(key: AnyDataPathComponent): key is MapKeyDataPathComponent {
  return typeof key === 'string';
}

export function dataPathComponentToMapKey(key: MapKeyDataPathComponent | IndexOrKeyDataPathComponent): string {
  return typeof key === 'string' ? key : key.v.toString(10);
}

export function dataPathComponentIsListIndex(key: AnyDataPathComponent): key is ListIndexDataPathComponent {
  return typeof key === 'number';
}

export function dataPathComponentToListIndex(
  component: ListIndexDataPathComponent | IndexOrKeyDataPathComponent,
): number {
  return typeof component === 'number' ? component : component.v;
}

export function dataPathComponentToListIndexOrFail(component: EditingForwardDataPathComponent): number {
  if (dataPathComponentIsListIndexLike(component)) {
    return dataPathComponentToListIndex(component);
  } else {
    throw new DataModelOperationError('Only can get value from list by index like path component.');
  }
}

export function listIndexToDataPathComponent(component: ListIndexDataPathComponent): number {
  return component;
}

export function dataPathComponentIsMapKeyLike(
  component: AnyDataPathComponent,
): component is string | IndexOrKeyDataPathComponent {
  return typeof component === 'string' || dataPathComponentIsIndexOrKey(component);
}

export function dataPathComponentIsIndexOrKey(
  component: AnyDataPathComponent,
): component is IndexOrKeyDataPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.IndexOrKey;
}

export function dataPathComponentIsPointer(component: AnyDataPathComponent): component is PointerPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.Pointer;
}

export function forwardDataPathComponentToString(component: SerializableForwardDataPathComponent): string {
  switch (typeof component) {
    case 'number':
      return component.toString(10);
    case 'string':
      return component;
    default:
      return component.v.toString(10);
  }
}

export function dataPathComponentIsKey(component: AnyDataPathComponent): component is KeyPathComponent {
  return typeof component === 'object' && component.t === DataPathComponentType.Key;
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

export function headDataPathComponent(path: ForwardDataPath): ForwardDataPathComponent;
export function headDataPathComponent(path: EditingForwardDataPath): EditingForwardDataPathComponent;
export function headDataPathComponent(path: DataPath): DataPathComponent;
export function headDataPathComponent(path: MultiDataPath): MultiDataPathComponent;
export function headDataPathComponent(path: AnyDataPath): AnyDataPathComponent {
  if (!path.components[0]) {
    throw new Error('Cannot get first path component of empty path');
  }
  return path.components[0];
}

export function headDataPathComponentOrUndefined(
  path: ForwardDataPath | undefined,
): ForwardDataPathComponent | undefined;
export function headDataPathComponentOrUndefined(
  path: EditingForwardDataPath | undefined,
): EditingForwardDataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: DataPath | undefined): DataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: MultiDataPath | undefined): MultiDataPathComponent | undefined;
export function headDataPathComponentOrUndefined(path: AnyDataPath | undefined): AnyDataPathComponent | undefined {
  return path?.components[0];
}

export function tailDataPathComponent<Path extends AnyDataPath>(path: Path): DataPathToComponentType<Path> {
  if (!path.components[path.components.length - 1]) {
    throw new Error('Cannot get first path component of empty path');
  }
  return path.components[path.components.length - 1] as DataPathToComponentType<Path>;
}

export function tailDataPathComponentOrUndefined<Path extends MultiDataPath>(
  path: Path | undefined,
): DataPathToComponentType<Path> | undefined {
  return path?.components[path.components.length - 1] as DataPathToComponentType<Path> | undefined;
}

export function popDataPath(path: ForwardDataPath): ForwardDataPath;
export function popDataPath(path: DataPath): DataPath;
export function popDataPath(path: MultiDataPath): MultiDataPath;
export function popDataPath(path: AnyDataPath): AnyDataPath {
  return {
    isAbsolute: path.isAbsolute,
    components: path.components.slice(0, path.components.length - 1),
  } as AnyDataPath;
}

export function pushDataPath(path: ForwardDataPath, component: ForwardDataPathComponent): ForwardDataPath;
export function pushDataPath(
  path: EditingForwardDataPath,
  component: EditingForwardDataPathComponent,
): EditingForwardDataPath;
export function pushDataPath(path: DataPath, component: ForwardDataPathComponent): DataPath;
export function pushDataPath(path: MultiDataPath, component: ForwardDataPathComponent): MultiDataPath;
export function pushDataPath(
  path: AnyDataPath,
  component: ForwardDataPathComponent | EditingForwardDataPathComponent,
): AnyDataPath {
  if (dataPathLength(path) > 0 && dataPathComponentIsKey(tailDataPathComponent(path))) {
    throw new Error('Cannot push to points key path.');
  }
  return {
    isAbsolute: path.isAbsolute,
    components: [...path.components, component],
  } as AnyDataPath;
}

export function shiftDataPath(path: ForwardDataPath, count?: number): ForwardDataPath;
export function shiftDataPath(path: EditingForwardDataPath, count?: number): EditingForwardDataPath;
export function shiftDataPath(path: DataPath, count?: number): DataPath;
export function shiftDataPath(path: MultiDataPath, count?: number): MultiDataPath;
export function shiftDataPath(path: AnyDataPath, count?: number): AnyDataPath;
export function shiftDataPath(path: AnyDataPath, count = 1): AnyDataPath {
  // Don't copy isAbsolute.
  return {components: path.components.slice(count)} as AnyDataPath;
}

export function safeShiftDataPath(path: ForwardDataPath | undefined): ForwardDataPath | undefined;
export function safeShiftDataPath(path: EditingForwardDataPath | undefined): EditingForwardDataPath | undefined;
export function safeShiftDataPath(path: DataPath | undefined): DataPath | undefined;
export function safeShiftDataPath(path: MultiDataPath | undefined): MultiDataPath | undefined;
export function safeShiftDataPath(path: AnyDataPath | undefined): AnyDataPath | undefined {
  return path === undefined || path.components.length === 0 ? undefined : shiftDataPath(path);
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
  return {components: [component, ...path.components]} as AnyDataPath;
}

export function dataPathLength(path: AnyDataPath): number {
  return path.components.length;
}

function parsedPathToDataPath(parsed: ParsedPath, pathType: 'forward' | 'single' | undefined): MultiDataPath {
  const components = parsed.c.map((c): MultiDataPathComponent => {
    if (typeof c === 'string') {
      return /^[1-9][0-9]*$/.test(c) ? {t: DataPathComponentType.IndexOrKey, v: Number(c)} : c;
    } else {
      switch (c.type) {
        case 'wildcard':
          if (pathType) {
            throw new Error(`${pathType} path cannot contain wildcard.`);
          }
          return {t: DataPathComponentType.WildCard};

        case 'variable':
          if (pathType === 'forward') {
            throw new Error(`${pathType} path cannot contain variable.`);
          }
          return {t: DataPathComponentType.Nested, v: parsedPathToDataPath(c.path, pathType)};
      }
    }
  });

  if (parsed.p) {
    components.push(keyDataPathComponent);
  }

  switch (parsed.t) {
    case 'abs':
      return {isAbsolute: true, components};
    case 'ctx':
      return {ctx: parsed.t, r: parsed.r, components};
    case 'rel':
      return {r: parsed.r, components};
  }
}

export function parsePath(source: string, pathType: 'single'): DataPath;
export function parsePath(source: string, pathType: 'forward'): ForwardDataPath;
export function parsePath(source: string): MultiDataPath;
export function parsePath(source: string, pathType?: 'forward' | 'single'): MultiDataPath {
  return parsedPathToDataPath(parse(source), pathType);
}

export function stringToDataPathComponent(source: string): ForwardDataPathComponent {
  if (/^[0-9]+$/.test(source)) {
    return {t: DataPathComponentType.IndexOrKey, v: Number(source)};
  } else {
    return source;
  }
}

export function stringArrayToDataPath(source: readonly string[]): ForwardDataPath {
  return {components: source.map((component) => stringToDataPathComponent(component))};
}

export function toPointerPathComponent(pointer: DataPointer): PointerPathComponent {
  return {t: DataPathComponentType.Pointer, ...pointer};
}

export function toMapKeyDataPathComponent(key: string): MapKeyDataPathComponent {
  return key;
}

export function toListIndexDataPathComponent(index: number): ListIndexDataPathComponent {
  return index;
}

export function forwardDataPathComponentEquals(
  lhs: EditingForwardDataPathComponent,
  rhs: EditingForwardDataPathComponent,
): boolean {
  if (typeof lhs !== 'object') {
    return lhs === rhs;
  }
  if (typeof rhs !== 'object' || lhs.t !== rhs.t) {
    return false;
  }
  switch (lhs.t) {
    case DataPathComponentType.IndexOrKey: {
      return lhs.v === (rhs as IndexOrKeyDataPathComponent).v;
    }
    case DataPathComponentType.Pointer:
      // indexはキャッシュなので比較不要
      return getIdFromDataPointer(lhs) === getIdFromDataPointer(rhs as PointerPathComponent);
  }
}

export function forwardDataPathEquals(
  lhs: EditingForwardDataPath | undefined,
  rhs: EditingForwardDataPath | undefined,
): boolean {
  if (lhs === undefined || rhs === undefined) {
    return lhs === rhs;
  }
  const length = dataPathLength(lhs);
  if (length !== dataPathLength(rhs)) {
    return false;
  }

  for (let i = 0; i < length; i++) {
    if (!forwardDataPathComponentEquals(lhs.components[i], rhs.components[i])) {
      return false;
    }
  }
  return true;
}

export function dataPathReverseCount(path: AnyDataPath): number {
  return path.r ?? 0;
}
