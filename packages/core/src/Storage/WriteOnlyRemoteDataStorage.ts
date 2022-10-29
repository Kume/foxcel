import DataStorage from './DataStorage';

export interface RemoteDataStorageSaveItem {
  readonly path: readonly string[];
  readonly content: string;
}

export class WriteOnlyRemoteDataStorage implements DataStorage {
  private _items: RemoteDataStorageSaveItem[] = [];
  private _deletePaths: (readonly string[])[] = [];

  public get items(): readonly RemoteDataStorageSaveItem[] {
    return this._items;
  }

  public get deletePaths(): readonly (readonly string[])[] {
    return this._deletePaths;
  }

  public async saveAsync(path: readonly string[], content: string): Promise<void> {
    this._items.push({path, content});
  }

  public async deleteAsync(paths: readonly string[]): Promise<void> {
    this._deletePaths.push(paths);
  }

  loadAsync(): Promise<string> {
    throw new Error('this storage is write only');
  }
}
