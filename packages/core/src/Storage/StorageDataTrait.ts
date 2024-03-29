import {getForPath, setForPath} from './StorageCommon';

export interface StorageDataTrait<T> {
  convert(source: unknown): T;
  convertBack(model: T): unknown;
  setForPath(destination: T, model: T, path: readonly string[]): T;
  getForPath(model: T, path: readonly string[]): T | undefined;
  mapModelForEachAsync(model: T, callback: (value: T, key: string) => Promise<void>): Promise<void>;
  mapModelForEach(model: T, callback: (value: T, key: string) => void): void;
  modelEquals(a: T, b: T): boolean;
  stringModel(str: string): T;
}

export const RawStorageDataTrait: StorageDataTrait<unknown> = {
  convert(source: unknown): unknown {
    return source;
  },
  convertBack(model: unknown): unknown {
    return model;
  },
  setForPath,
  getForPath,
  mapModelForEach(model: unknown, callback: (value: unknown, key: string) => void): void {
    if (typeof model === 'object' && model !== null) {
      for (const key of Object.keys(model)) {
        callback((model as {[key: string]: unknown})[key], key);
      }
    }
  },
  async mapModelForEachAsync(model: unknown, callback: (value: unknown, key: string) => Promise<void>): Promise<void> {
    if (typeof model === 'object' && model !== null) {
      for (const key of Object.keys(model)) {
        await callback((model as {[key: string]: unknown})[key], key);
      }
    }
  },
  modelEquals(a: unknown, b: unknown): boolean {
    return a === b;
  },
  stringModel(str: string): unknown {
    return str;
  },
};
