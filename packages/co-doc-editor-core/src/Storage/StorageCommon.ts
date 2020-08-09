export function unknownIsObject(data: unknown): data is {[key: string]: unknown} {
  return data !== null && typeof data === 'object';
}

export function getForPath(data: unknown, path: readonly string[]): unknown {
  if (path.length === 0) {
    return data;
  }
  if (unknownIsObject(data)) {
    const [firstPathComponent, ...childPath] = path;
    return getForPath(data[firstPathComponent], childPath);
  }
  return undefined;
}

export function setForPath(destination: unknown, data: unknown, path: readonly string[]): unknown {
  switch (path.length) {
    case 0:
      return;
    case 1:
      if (unknownIsObject(destination)) {
        return {...destination, [path[0]]: data};
      }
      return destination;
    default:
      if (unknownIsObject(destination)) {
        const [firstPathComponent, ...childPath] = path;
        return {...destination, [firstPathComponent]: setForPath(destination[firstPathComponent], data, childPath)};
      }
      return destination;
  }
}
