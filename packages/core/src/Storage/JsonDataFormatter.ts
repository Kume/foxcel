import {DataFormatter} from './DataFormatter';

export class JsonDataFormatter implements DataFormatter {
  format(data: unknown): string {
    return JSON.stringify(data);
  }

  parse(source: string): unknown {
    return JSON.parse(source);
  }
}
