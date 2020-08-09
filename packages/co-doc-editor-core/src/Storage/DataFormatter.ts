export interface DataFormatter {
  format(data: unknown): string;
  parse(source: string): unknown;
}
