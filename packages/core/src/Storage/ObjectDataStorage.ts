import {DataStorage} from './DataStorage';

export class ObjectDataStorage implements DataStorage {
  get data(): {[key: string]: string} {
    return this._data;
  }

  private _data: {[key: string]: string} = {};

  public deleteHistory: (readonly string[])[] = [];
  public writeHistory: [readonly string[], string][] = [];
  public readHistory: (readonly string[])[] = [];

  public clearHistory(): void {
    this.deleteHistory = [];
    this.writeHistory = [];
    this.readHistory = [];
  }

  public async saveAsync(paths: Array<string>, content: string): Promise<void> {
    this.writeHistory.push([paths, content]);
    this._data[paths.join('/')] = content;
  }

  public async loadAsync(paths: Array<string>): Promise<string> {
    this.readHistory.push(paths);
    const path = paths.join('/');
    if (!(path in this._data)) {
      throw new Error(`File not found. ${path}`);
    }
    return this._data[path];
  }

  public async exists(paths: string[]): Promise<boolean> {
    return true;
  }

  public async deleteAsync(paths: Array<string>): Promise<void> {
    this.deleteHistory.push(paths);
    delete this._data[paths.join('/')];
  }
}
