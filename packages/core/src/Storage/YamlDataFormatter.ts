import {DataFormatter} from './DataFormatter';
import * as Yaml from 'js-yaml';

export class YamlDataFormatter implements DataFormatter {
  format(data: unknown): string {
    return Yaml.dump(data);
  }

  parse(source: string): unknown {
    return Yaml.load(source);
  }
}
