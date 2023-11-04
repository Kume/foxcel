export type ParsedPathComponent = {type: 'wildcard'} | {type: 'variable'; path: ParsedPath} | string;

export type ParsedPath =
  | {t: 'abs'; c: ParsedPathComponent[]; p: boolean}
  | {t: 'ctx'; r: number; c: ParsedPathComponent[]; p: boolean}
  | {t: 'rel'; r: number; c: ParsedPathComponent[]; p: boolean};

declare function parse(source: string): ParsedPath;
