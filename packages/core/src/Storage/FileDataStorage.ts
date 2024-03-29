import {DataStorage} from './DataStorage';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const readFile = util.promisify(fs.readFile);
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

export default class FileDataStorage implements DataStorage {
  private _rootPath: string;

  constructor(rootPath: string) {
    this._rootPath = rootPath;
  }

  public async saveAsync(paths: readonly string[], content: string): Promise<void> {
    if (paths.length > 1) {
      const dirPaths = paths.slice(0, paths.length - 1);
      const dirPath = path.join(this._rootPath, ...dirPaths);
      try {
        await stat(path.join(this._rootPath, ...dirPaths));
      } catch (error) {
        if (typeof error === 'object' && error !== null && (error as Record<string, any>).code === 'ENOENT') {
          await mkdir(dirPath);
        } else {
          throw error;
        }
      }
    }

    const filePath = path.join(this._rootPath, ...paths);

    await writeFile(filePath, content);
  }

  public async loadAsync(paths: readonly string[]): Promise<string> {
    const filePath = path.join(this._rootPath, ...paths);
    const content = await readFile(filePath);
    return content.toString();
  }

  public async exists(paths: readonly string[]): Promise<boolean> {
    return fs.existsSync(path.join(this._rootPath, ...paths));
  }

  public async deleteAsync(paths: readonly string[]): Promise<void> {
    // TODO
  }
}
