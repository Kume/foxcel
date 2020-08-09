export type ParsedPathElement =
  | {type: 'wildcard'}
  | {type: 'variable'; path: ParsedPath}
  | {type: 'parent'}
  | {type: 'absolute'}
  | {type: 'key'}
  | {type: 'context'; key: string};

export type ParsedPath = Array<ParsedPathElement | string>;

declare function parse(source: string): ParsedPath;
