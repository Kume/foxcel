import {DataPointer, getIdFromDataPointer} from '..';
import {UISchemaContext} from './UISchemaContext';
import {UIModel} from './UIModelTypes';
import {Writable} from '../common/utilTypes';
import {UISchema} from './UISchemaTypes';

export interface ContentListUIFocusNode {
  readonly type: 'contentList';
  readonly isPrimary: boolean | undefined;
  readonly active: DataPointer | undefined;
  readonly child: UIFocusNode | undefined;
}

export interface FormUIFocusNode {
  readonly type: 'form';
  readonly isPrimary: boolean | undefined;
  readonly active?: number;
  readonly children: {[id: number]: UIFocusNode};
}

export interface TabUIFocusNode {
  readonly type: 'tab';
  readonly isPrimary: boolean | undefined;
  readonly active: number;
  readonly child: UIFocusNode | undefined;
}

export interface TableUIFocusNode {
  readonly type: 'table';
  readonly isPrimary: boolean | undefined;
  readonly activeRow: DataPointer;
  readonly activeColumn?: number;
}

export type UIFocusNode = ContentListUIFocusNode | FormUIFocusNode | TabUIFocusNode | TableUIFocusNode;

export interface UIDataFocusLogNode {
  /**
   * active
   */
  readonly a?: DataPointer;

  /**
   * children by id or by schema index
   */
  readonly c: {readonly [id: number]: UIDataFocusLogNode | undefined};
}

export interface UISchemaFocusLogNode {
  /**
   * active schema index
   */
  readonly a?: number;

  /**
   * children by index
   */
  readonly c: {readonly [index: number]: UISchemaFocusLogNode | undefined};
}

type MatchedModel<Schema extends UISchema, Model extends UIModel> = Model extends {type: Schema['type']}
  ? Model
  : never;

function assertModelTypeForSchema<Schema extends UISchema>(
  schema: Schema,
  model: UIModel,
): asserts model is MatchedModel<Schema, UIModel> {
  if (schema.type !== model.type) {
    throw new Error('ui model is not match to schema');
  }
}

export function logSchemaFocus(
  model: UIModel,
  uiSchemaContext: UISchemaContext,
  lastFocus: UISchemaFocusLogNode | undefined,
): UISchemaFocusLogNode | undefined {
  const {currentSchema} = uiSchemaContext;
  switch (currentSchema.type) {
    case 'tab': {
      assertModelTypeForSchema(currentSchema, model);
      if (!model.currentChild) {
        return lastFocus;
      }
      const index = model.currentTabIndex;
      const childContext = uiSchemaContext.digForIndex(index);
      return {
        a: index,
        c: {...lastFocus?.c, [index]: logSchemaFocus(model.currentChild, childContext, lastFocus?.c[index])},
      };
    }
    case 'form': {
      assertModelTypeForSchema(currentSchema, model);
      const children: Writable<UISchemaFocusLogNode['c']> = {...lastFocus?.c};
      model.contents.forEach(({model}, index) => {
        const contentFocus = logSchemaFocus(model, uiSchemaContext.digForIndex(index), lastFocus?.c[index]);
        if (children[index] || contentFocus) {
          children[index] = contentFocus;
        }
      });
      // 今の所aプロパティは必ず空とする
      return {c: children};
    }
    case 'contentList': {
      assertModelTypeForSchema(currentSchema, model);
      return model.content ? logSchemaFocus(model.content, uiSchemaContext.content(), lastFocus) : lastFocus;
    }
  }
  return undefined;
}

export function logDataFocus(
  model: UIModel,
  uiSchemaContext: UISchemaContext,
  lastFocus: UIDataFocusLogNode | undefined,
): UIDataFocusLogNode | undefined {
  const {currentSchema} = uiSchemaContext;
  switch (currentSchema.type) {
    case 'tab': {
      assertModelTypeForSchema(currentSchema, model);
      if (!model.currentChild) {
        return lastFocus;
      }
      const index = model.currentTabIndex;
      const childContext = uiSchemaContext.digForIndex(index);
      const currentChild = logDataFocus(model.currentChild, childContext, lastFocus?.c[index]);
      return lastFocus?.c[index] === currentChild ? lastFocus : {c: {...lastFocus?.c, [index]: currentChild}};
    }
    case 'form': {
      assertModelTypeForSchema(currentSchema, model);
      const children: Writable<UIDataFocusLogNode['c']> = {...lastFocus?.c};
      model.contents.forEach(({model}, index) => {
        const contentFocus = logDataFocus(model, uiSchemaContext.digForIndex(index), lastFocus?.c[index]);
        if (children[index] || contentFocus) {
          children[index] = contentFocus;
        }
      });
      return {c: children};
    }
    case 'contentList': {
      assertModelTypeForSchema(currentSchema, model);
      if (!model.content) {
        return lastFocus;
      }
      const pointer = model.indexes[model.currentIndex].pointer;
      const id = getIdFromDataPointer(pointer);
      const currentChildFocus = logDataFocus(model.content, uiSchemaContext.content(), lastFocus?.c[id]);
      return {a: pointer, c: {...lastFocus?.c, [id]: currentChildFocus}};
    }
    default:
      return undefined;
  }
}
