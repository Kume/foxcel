import * as vscode from 'vscode';
import {SaveFileMessage, YamlDataFormatter} from '@foxcel/core';
import {dirUri} from './VSCodeStorage';

function isValidPath(path: readonly string[]): boolean {
  if (!Array.isArray(path)) {
    return false;
  }
  for (const pathElement of path) {
    if (
      typeof pathElement !== 'string' ||
      pathElement === '.' ||
      pathElement === '..' ||
      pathElement.includes('/') ||
      pathElement.includes('\\')
    ) {
      return false;
    }
  }
  return true;
}

const textEncoder = new TextEncoder();

export async function saveFile(schemaUri: vscode.Uri, message: SaveFileMessage): Promise<void> {
  const dirUrl = dirUri(schemaUri);
  const formatter = new YamlDataFormatter();
  if (Array.isArray(message.items)) {
    for (const item of message.items) {
      if (isValidPath(item.path)) {
        const parsed = JSON.parse(item.content);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.joinPath(dirUrl, ...item.path),
          textEncoder.encode(formatter.format(parsed)),
        );
      }
    }
  }
  if (Array.isArray(message.deletePaths)) {
    for (const deletePath of message.deletePaths) {
      if (isValidPath(deletePath)) {
        await vscode.workspace.fs.delete(vscode.Uri.joinPath(dirUrl, ...deletePath));
      }
    }
  }
}
