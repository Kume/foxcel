export function mapObjectToObject<V, R>(
  obj: {[key: string]: V},
  mapper: (value: V, key: string) => R,
): {readonly [key: string]: R} {
  const ret: {[key: string]: R} = {};
  for (const [key, value] of Object.entries(obj)) {
    ret[key] = mapper(value, key);
  }
  return ret;
}

export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R | undefined] | undefined,
  ignoreUndefined: true,
): {[key: string]: R};
export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R] | undefined,
  ignoreUndefined?: false,
): {[key: string]: R};
export function mapToObject<V, R>(
  values: readonly V[],
  mapper: (value: V, index: number) => readonly [string, R] | undefined,
  ignoreUndefined?: boolean,
): {[key: string]: R} {
  const ret: {[key: string]: R} = {};
  for (let i = 0; i < values.length; i++) {
    const mapped = mapper(values[i], i);
    if (mapped) {
      const [key, value] = mapped;
      if (!ignoreUndefined || value !== undefined) {
        ret[key] = value;
      }
    }
  }
  return ret;
}

export function resolvePath(currentPath: readonly string[], targetPath: readonly string[]): string[] {
  const path = [...currentPath, ...targetPath];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '..') {
      if (i === 0) {
        throw new Error('Cannot reference above the top directory');
      }
      path.splice(i - 1, 2);
      i--;
    } else {
      i++;
    }
  }
  return path;
}

export function validIndexOrUndefined(index: number): number | undefined {
  return index < 0 ? undefined : index;
}

export const emptyArray: readonly any[] = [];
Object.freeze(emptyArray);

export function emptyFunction(): void {
  // 何もしない
}

export function compact<T>(values: readonly (T | null | undefined | false)[]): T[] {
  return values.filter((i) => i !== undefined && i !== null && i !== false) as T[];
}

export function isReadonlyArray<T>(value: readonly T[] | unknown): value is readonly T[] {
  return Array.isArray(value);
}

export function rangeBySize(start: number, size: number): number[] {
  return [...Array(size)].map((_, i) => start + i);
}

export function rangeLt(start: number, sup: number): number[] {
  return rangeBySize(start, sup - start);
}

export function rangeInArrayEqual<Item>(
  a: readonly Item[],
  b: readonly Item[],
  itemEquals: (a: Item, b: Item) => boolean,
  start: number,
  size: number,
): boolean {
  for (let i = start; i < start + size; i++) {
    if (!itemEquals(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

export function isNullOrEmptyString(value: string | undefined | null): value is '' | null | undefined {
  return value == null || value === '';
}

export function compareVersion(a: `${number}.${number}`, b: `${number}.${number}`): -1 | 0 | 1 {
  const [a1, a2] = a.split('.').map(Number);
  const [b1, b2] = b.split('.').map(Number);
  const sign1 = Math.sign(a1 - b1) as -1 | 0 | 1;
  if (sign1 !== 0) {
    return sign1;
  }
  return Math.sign(a2 - b2) as -1 | 0 | 1;
}

export function versionGte(a: `${number}.${number}`, b: `${number}.${number}`): boolean {
  return compareVersion(a, b) >= 0;
}
