import * as vscode from 'vscode';
import DataStorage from '@foxcel/core/dist/Storage/DataStorage';

export function dirUri(uri: vscode.Uri) {
  const pathComponents = uri.path.split('/');
  pathComponents.pop();
  return uri.with({path: pathComponents.join('/')});
}

export function fileNameOfUri(uri: vscode.Uri): string {
  const pathComponents = uri.path.split('/');
  return pathComponents[pathComponents.length - 1];
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class VSCodeStorage implements DataStorage {
  public constructor(private readonly rootUri: vscode.Uri) {}

  private filepath(paths: readonly string[]): vscode.Uri {
    return vscode.Uri.joinPath(this.rootUri, ...paths);
  }

  public async saveAsync(paths: readonly string[], content: string): Promise<void> {
    await vscode.workspace.fs.writeFile(this.filepath(paths), textEncoder.encode(content));
  }
  public async loadAsync(paths: readonly string[]): Promise<string> {
    return textDecoder.decode(await vscode.workspace.fs.readFile(this.filepath(paths)));
  }
  public async deleteAsync(paths: readonly string[]): Promise<void> {
    await vscode.workspace.fs.delete(this.filepath(paths));
  }
  public async exists(paths: readonly string[]): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(this.filepath(paths));
      return true;
    } catch (error) {
      return false;
    }
  }
}
