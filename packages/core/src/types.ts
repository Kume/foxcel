declare global {
  interface ArrayConstructor {
    isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>;
  }
}

export type ReplaceTupleFirstItem<Tuple extends readonly any[], First> = Tuple extends readonly [any, ...infer Tail]
  ? [First, ...Tail]
  : never;
