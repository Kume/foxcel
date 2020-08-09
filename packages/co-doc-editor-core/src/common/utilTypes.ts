export type Writable<T> = {-readonly [K in keyof T]: Writable<T[K]>};
export type ShallowWritable<T> = {-readonly [K in keyof T]: T[K]};
