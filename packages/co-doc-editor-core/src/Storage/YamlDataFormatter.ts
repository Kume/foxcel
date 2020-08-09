import {DataFormatter} from './DataFormatter';
import * as Yaml from 'js-yaml';

export default class YamlDataFormatter implements DataFormatter {
  format(data: unknown): string {
    return Yaml.safeDump(data);
  }

  parse(source: string): unknown {
    return Yaml.safeLoad(source);
  }
}
