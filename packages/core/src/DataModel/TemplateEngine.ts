import {DataPath, MultiDataPath, parsePath} from './DataPath';
import {DataModel} from './DataModelTypes';
import {dataModelIsInteger, dataModelIsString, numberDataModelToNumber, stringDataModelToString} from './DataModel';
import {getDataModelBySinglePath} from './DataModelCollector';
import {DataModelContextWithoutSchema} from './DataModelContext';

export interface TemplateToken {
  key: string;
  start: number;
  end: number;
  path?: MultiDataPath;
}

interface TextTemplateLineNode {
  readonly type: 'text';
  readonly text: string;
}

interface VariableTemplateLineNode {
  readonly type: 'var';
  readonly path: DataPath;
}

type TemplateLineNode = TextTemplateLineNode | VariableTemplateLineNode;

export interface TemplateLine {
  readonly nodes: readonly TemplateLineNode[];
}

type TextFilledTemplateNode = string;
type EmptyFilledTemplateNode = undefined;
export type FilledTemplateNode = TextFilledTemplateNode | EmptyFilledTemplateNode;
export type FilledTemplate = readonly FilledTemplateNode[];

export function parseTemplateLine(source: string): TemplateLine {
  let searchCursor = 0;
  const nodes: TemplateLineNode[] = [];
  for (;;) {
    let start = source.indexOf('{{', searchCursor);
    if (start > searchCursor) {
      nodes.push({type: 'text', text: source.substr(searchCursor, start - searchCursor)});
    }
    if (start < 0) {
      if (searchCursor < source.length) {
        nodes.push({type: 'text', text: source.substr(searchCursor)});
      }
      return {nodes};
    }

    let nextStart = source.indexOf('{{', start + 2);
    const nextEnd = source.indexOf('}}', start + 2);
    if (nextEnd < 0) {
      return {nodes};
    }
    while (nextStart > 0 && nextStart < nextEnd) {
      start = nextStart;
      nextStart = source.indexOf('{{', start + 2);
    }

    // eslint-disable-next-line no-useless-catch
    try {
      const key = source.substr(start + 2, nextEnd - start - 2);
      const path = parsePath(key, 'single');
      nodes.push({type: 'var', path});
    } catch (error) {
      console.error(error);
      nodes.push({type: 'text', text: '{{parse error!}}'});
    }

    searchCursor = nextEnd + 2;
  }
}

export function dataPathToTemplateLine(path: DataPath): TemplateLine {
  return {nodes: [{type: 'var', path}]};
}

export function fillTemplateLine(template: TemplateLine, context: DataModelContextWithoutSchema): FilledTemplateNode[] {
  return template.nodes.map((node) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'var': {
        const value = getDataModelBySinglePath(node.path, context);
        if (value === undefined) {
          return undefined;
        } else if (dataModelIsString(value)) {
          return stringDataModelToString(value);
        } else if (dataModelIsInteger(value)) {
          return numberDataModelToNumber(value).toString();
        } else {
          return undefined;
        }
      }
    }
  });
}

export function fillTemplateLineAndToString(template: TemplateLine, context: DataModelContextWithoutSchema): string {
  return fillTemplateLine(template, context)
    .map((node) => {
      if (typeof node === 'string') {
        return node;
      } else {
        return '';
      }
    })
    .join('');
}

export function stringToFilledTemplateLine(str: string): FilledTemplate {
  return [str];
}
