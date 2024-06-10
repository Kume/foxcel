export type ParsedPathComponent =
  | {type: 'wildcard'}
  | {type: 'nested'; path: ParsedPath}
  | {type: 'alias'; name: string}
  | string;

export type ParsedPath =
  | {t: 'abs'; c: ParsedPathComponent[] | undefined; p: boolean}
  | {t: 'ctx'; r: number; c: ParsedPathComponent[] | undefined; key: string; p: boolean}
  | {t: 'rel'; r: number; c: ParsedPathComponent[] | undefined; p: boolean};

declare function parse(source: string): ParsedPath;
