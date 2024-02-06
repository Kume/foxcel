import {UIModel, UIModelForType} from './UIModelTypes';

export type UIModelPathWithParameterComponent =
  | readonly ['form', string | true]
  | readonly ['table', string | number, string | true]
  | readonly ['mappingTable', string, string];

export type UIModelPathComponent = UIModelPathWithParameterComponent | readonly ['tab' | 'contentList'];

export type UIModelPath = readonly UIModelPathComponent[];

export function getUIModelByPathAndCheckType<Type extends UIModel['type']>(
  root: UIModel | undefined,
  path: UIModelPath,
  type: Type,
): UIModelForType<Type> {
  const model = getUIModelByPath(root, path);
  if (model?.type !== type) {
    throw new Error(`Invalid ui model type. expected=${type} actual=${model?.type ?? ''}`);
  }
  return model as UIModelForType<Type>;
}

export function getUIModelByPath(root: UIModel | undefined, path: UIModelPath): UIModel | undefined {
  return getUIModelByPathRecursive(root, path, 0);
}

function getUIModelByPathRecursive(model: UIModel | undefined, path: UIModelPath, index: number): UIModel | undefined {
  if (path.length === index) {
    return model;
  }
  if (!model) {
    return undefined;
  }
  const current = path[index];
  switch (current[0]) {
    case 'form':
      if (model.type === 'form') {
        const item = model.contents.find((content) => {
          if (current[1] === true) {
            return content.model.isKey;
          } else {
            return !content.model.isKey && content.model.schema.key === current[1];
          }
        })?.model;
        return getUIModelByPathRecursive(item, path, index + 1);
      } else {
        return undefined;
      }
    case 'table':
      if (model.type === 'table') {
        const row =
          typeof current[1] === 'string' ? model.rows.find((row) => row.key === current[1]) : model.rows[current[1]];
        const cell = row?.cells.find((cell) => {
          if (current[2] === true) {
            return cell.isKey;
          } else {
            return !cell.isKey && cell.schema.key === current[2];
          }
        });
        return getUIModelByPathRecursive(cell, path, index + 1);
      } else {
        return undefined;
      }
    case 'mappingTable':
      if (model.type === 'mappingTable') {
        const row = model.rows.find((row) => row.key === current[1]);
        if (!row) return undefined;
        const cell = row.cells.find((cell) => cell.schema?.key === current[2]);
        return getUIModelByPathRecursive(cell, path, index + 1);
      } else {
        return undefined;
      }
    case 'tab':
      return model.type === 'tab' ? getUIModelByPathRecursive(model.currentChild, path, index + 1) : undefined;
    case 'contentList':
      return model.type === 'contentList' ? getUIModelByPathRecursive(model.content, path, index + 1) : undefined;
  }
}
