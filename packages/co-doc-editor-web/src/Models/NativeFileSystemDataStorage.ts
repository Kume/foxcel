import DataStorage from 'co-doc-editor-core/dist/Storage/DataStorage';

interface FileSystemDirectoryNode {
  readonly handle: FileSystemDirectoryHandleOld;
  readonly children: Map<string, FileSystemDirectoryNode>;
  readonly files: Map<string, FileSystemFileHandleOld>;
}

async function getDirectoryNode(rootNode: FileSystemDirectoryNode, path: readonly string[]): Promise<FileSystemDirectoryNode | undefined> {
  if (path.length === 0) {
    return rootNode;
  }
  const [firstNodeName, ...nextPath] = path;
  const childNode = rootNode.children.get(firstNodeName);
  if (childNode) {
    return getDirectoryNode(childNode, nextPath);
  }

  try {
    const handle = await rootNode.handle.getDirectory(firstNodeName);
    return getDirectoryNode({handle, files: new Map(), children: new Map()}, nextPath);
  } catch (error) {
    console.warn(error);
    return undefined;
  }
}

function splitDirectoryAndFilePath(path: readonly string[]) {
  return {directoryPath: path.slice(0, -1), fileName: path[path.length - 1] };
}

export class NativeFileSystemDataStorage implements DataStorage {
  private rootDirectory!: FileSystemDirectoryNode;
  private _rootSchemaFiles: string[] = [];

  async init(): Promise<boolean> {
    let handle: FileSystemDirectoryHandleOld | undefined;
    // if (window.showOpenDirectoryPicker) {
    //   handle = await window.showOpenDirectoryPicker();
    // }
    if (window.chooseFileSystemEntries) {
      handle = await window.chooseFileSystemEntries({type: 'open-directory'});
    }
    if (!handle) {
      alert('Native File System API 未対応です。');
      return false;
    }

    try {
      this.rootDirectory = {handle, children: new Map(), files: new Map()};

      for await (const entry of handle.getEntries()) {
        // if (entry.kind === 'directory') {
        if (entry.isDirectory) {
          this.rootDirectory.children.set(entry.name, {handle: entry, children: new Map(), files: new Map()});
        } else {
          this.rootDirectory.files.set(entry.name, entry);
          if (entry.name.match(/.+\.cds/)) {
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
    return !!await directory?.handle.getFile(paths[paths.length - 1]);
  }

  async loadAsync(paths: readonly string[]): Promise<string> {
    if (paths.length === 0) {
      throw new Error('Invalid file path');
    }
    const {fileName, directoryPath} = splitDirectoryAndFilePath(paths);
    const directory = await getDirectoryNode(this.rootDirectory, directoryPath);
    if (!directory) {
      throw new Error(`${paths.join('/')} not found.`)
    }
    return new Promise<string>((async (resolve, reject) => {
      const handle = await directory.handle.getFile(fileName);
      const reader = new FileReader();
      reader.readAsText(await handle.getFile());
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
    }));
  }

  async saveAsync(paths: readonly string[], content: string): Promise<void> {
    if (paths.length === 0) {
      throw new Error('Invalid file path');
    }
    const {fileName, directoryPath} = splitDirectoryAndFilePath(paths);
    const directory = await getDirectoryNode(this.rootDirectory, directoryPath);
    if (!directory) {
      throw new Error(`${paths.join('/')} not found.`)
    }
    const handle = await directory.handle.getFile(fileName);
    const writable = await handle.createWritable();
    await writable.write(content);
  }
}

type FileSystemKind = 'file' | 'directory';

interface FileSystemHandle {
  // readonly kind: FileSystemKind;
  readonly name: string;
}

///////////////////////////////////////////////////////////////////////////////////
// FileHandle
///////////////////////////////////////////////////////////////////////////////////

interface FileSystemWritableFileStream {
  write(data: string): Promise<void>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemFileHandleOld extends FileSystemHandle {
  readonly isFile: true;
  readonly isDirectory: false;
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

///////////////////////////////////////////////////////////////////////////////////
// DirectoryHandle
///////////////////////////////////////////////////////////////////////////////////

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

interface FileSystemDirectoryHandle extends FileSystemHandle, AsyncIterable<AnyFileSystemHandle> {
  readonly kind: 'directory';
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
}


interface FileSystemDirectoryHandleOld extends FileSystemHandle {
  isFile: false;
  isDirectory: true;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  getEntries(): AsyncIterable<AnyFileSystemHandleOld>;
  getFile(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandleOld>;
  getDirectory(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandleOld>;
}

type AnyFileSystemHandle = FileSystemFileHandle | FileSystemDirectoryHandle;
type AnyFileSystemHandleOld = FileSystemFileHandleOld | FileSystemDirectoryHandleOld;

interface ChooseFileSystemEntriesOptions {
  type: 'open-directory';
}

declare global {
  interface Window {
    showOpenDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
    chooseFileSystemEntries?(options: ChooseFileSystemEntriesOptions): Promise<FileSystemDirectoryHandleOld>;
  }
}
