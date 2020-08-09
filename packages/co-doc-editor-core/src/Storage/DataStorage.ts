export default interface DataStorage {
  saveAsync(paths: readonly string[], content: string): Promise<void>;

  loadAsync(paths: readonly string[]): Promise<string>;

  deleteAsync(paths: readonly string[]): Promise<void>;

  exists(paths: readonly string[]): Promise<boolean>;
}
