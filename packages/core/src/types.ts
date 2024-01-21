export type ReplaceTupleFirstItem<Tuple extends readonly any[], First> = Tuple extends readonly [any, ...infer Tail]
  ? [First, ...Tail]
  : never;
