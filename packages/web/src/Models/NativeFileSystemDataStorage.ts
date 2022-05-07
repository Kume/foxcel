import DataStorage from 'co-doc-editor-core/dist/Storage/DataStorage';
import type {} from 'wicg-file-system-access';

interface FileSystemDirectoryNode {
  readonly handle: FileSystemDirectoryHandle;
  readonly children: Map<string, FileSystemDirectoryNode>;
  readonly files: Map<string, FileSystemFileHandle>;
}

function createFileSystemDirectoryNode(handle: FileSystemDirectoryHandle): FileSystemDirectoryNode {
  return {
    handle,
    children: new Map<string, FileSystemDirectoryNode>(),
    files: new Map<string, FileSystemFileHandle>(),
  };
}

async function getDirectoryNode(
  rootNode: FileSystemDirectoryNode,
  path: readonly string[],
): Promise<FileSystemDirectoryNode | undefined> {
  if (path.length === 0) {
    return rootNode;
  }
  const [firstNodeName, ...nextPath] = path;
  const childNode = rootNode.children.get(firstNodeName);
  if (childNode) {
    return getDirectoryNode(childNode, nextPath);
  }

  try {
    const handle = await rootNode.handle.getDirectoryHandle(firstNodeName);
    return getDirectoryNode(createFileSystemDirectoryNode(handle), nextPath);
  } catch (error) {
    console.warn(error);
    return undefined;
  }
}

function splitDirectoryAndFilePath(path: readonly string[]) {
  return {directoryPath: path.slice(0, -1), fileName: path[path.length - 1]};
}

export class NativeFileSystemDataStorage implements DataStorage {
  private rootDirectory!: FileSystemDirectoryNode;
  private _rootSchemaFiles: string[] = [];

  async init(): Promise<boolean> {
    let handle: FileSystemDirectoryHandle | undefined;
    if (showDirectoryPicker) {
      handle = await showDirectoryPicker();
    }
    if (!handle) {
      alert('Native File System API 未対応です。');
      return false;
    }

    try {
      this.rootDirectory = createFileSystemDirectoryNode(handle);

      for await (const entry of handle.values()) {
        if (entry.isDirectory) {
          this.rootDirectory.children.set(entry.name, createFileSystemDirectoryNode(entry));
        } else {
          this.rootDirectory.files.set(entry.name, entry);
          if (/.+\.cds/.exec(entry.name)) {
            this._rootSchemaFiles.push(entry.name);
          }
        }
      }

      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  public get rootSchemaFiles(): readonly string[] {
    return this._rootSchemaFiles;
  }

  async deleteAsync(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    const {fileName, directoryPath} = splitDirectoryAndFilePath(paths);
    const directory = await getDirectoryNode(this.rootDirectory, directoryPath);
    if (directory) {
      await directory.handle.removeEntry(fileName);
    }
  }

  async exists(paths: readonly string[]): Promise<boolean> {
    if (paths.length === 0) {
      return false;
    }
    const directory = await getDirectoryNode(this.rootDirectory, paths.slice(0, -1));
    return !!(await directory?.handle.getFileHandle(paths[paths.length - 1]));
  }

  async loadAsync(paths: readonly string[]): Promise<string> {
    if (paths.length === 0) {
      throw new Error('Invalid file path');
    }
    const {fileName, directoryPath} = splitDirectoryAndFilePath(paths);
    const directory = await getDirectoryNode(this.rootDirectory, directoryPath);
    if (!directory) {
      throw new Error(`${paths.join('/')} not found.`);
    }
    const handle = await directory.handle.getFileHandle(fileName);
    const reader = new FileReader();
    reader.readAsText(await handle.getFile());
    return new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
    });
  }

  async saveAsync(paths: readonly string[], content: string): Promise<void> {
    if (paths.length === 0) {
      throw new Error('Invalid file path');
    }
    const {fileName, directoryPath} = splitDirectoryAndFilePath(paths);
    const directory = await getDirectoryNode(this.rootDirectory, directoryPath);
    if (!directory) {
      throw new Error(`${paths.join('/')} not found.`);
    }
    const handle = await directory.handle.getFileHandle(fileName);
    const writable = await handle.createWritable();
    await writable.write(content);
  }
}
