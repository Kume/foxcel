/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {ObjectDataStorage} from '../../Storage/ObjectDataStorage';
import {FullSpecSchemaSample} from '../../samples';
import {buildDataSchema} from '../../DataModel/DataSchema';
import {YamlDataFormatter} from '../../Storage/YamlDataFormatter';
import {buildUISchema} from '../../UIModel/UISchema';
import {getUIModelByPathAndCheckType, UIModelPath} from '../../UIModel/UIModelPath';
import {textUIModelSetText} from '../../UIModel/TextUIModel';
import {applyAppActionToState, AppState, initialAppState} from '../AppState';
import {numberUIModelDisplayText, numberUIModelSetText} from '../../UIModel/NumberUIModel';
import {checkboxUIModelSetValue, checkboxUIModelValue} from '../../UIModel/CheckboxUIModel';
import {mappingTableUIModelPaste} from '../../UIModel/MappingTableUIModel';

describe('Unit tests for simple form', () => {
  async function initAppState(): Promise<AppState> {
    const storage = new ObjectDataStorage();
    const config = FullSpecSchemaSample.rootSchema();
    const dataSchema = await buildDataSchema(config, storage, new YamlDataFormatter());
    const uiSchema = await buildUISchema(config, dataSchema, storage, new YamlDataFormatter());
    const initialData = FullSpecSchemaSample.basicInitialData();
    return applyAppActionToState(initialAppState, {type: 'init', uiSchema, data: initialData, dataSchema});
  }

  it('キー入力ができる', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [['tab'], ['contentList'], ['form', true]];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'text');
    // 初期状態はcontentListの一番上の要素のキーが入っている
    expect(model.isKey && model.value).toBe('first');

    const updatedAppState = applyAppActionToState(appState, textUIModelSetText(model, 'changed'));
    const updatedModel = getUIModelByPathAndCheckType(updatedAppState.uiModel, uiPath, 'text');
    // 編集したので、UIに表示されるテキストも変化する
    expect(updatedModel.isKey && updatedModel.value).toBe('changed');
  });

  it('テキスト入力ができる', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [['tab'], ['contentList'], ['form', 'singleLineText']];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'text');
    // 初期値は入ってないので、空文字が表示される
    expect(model.value).toBe('');

    const updatedState = applyAppActionToState(appState, textUIModelSetText(model, 'changed'));
    const updatedModel = getUIModelByPathAndCheckType(updatedState.uiModel, uiPath, 'text');
    // 入力した値に変化している
    expect(updatedModel.value).toBe('changed');
  });

  it('数値入力ができる', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [['tab'], ['contentList'], ['form', 'number']];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'number');
    // 初期値は入ってないので、空文字が表示される
    expect(numberUIModelDisplayText(model)).toBe('');

    const updatedState = applyAppActionToState(appState, numberUIModelSetText(model, '123')!);
    const updatedModel = getUIModelByPathAndCheckType(updatedState.uiModel, uiPath, 'number');
    // 入力した値に変化している
    expect(numberUIModelDisplayText(updatedModel)).toBe('123');
  });

  it('チェックボックスの入力ができる', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [['tab'], ['contentList'], ['form', 'check']];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'checkbox');
    // 初期値は入ってないので、未チェック扱い
    expect(checkboxUIModelValue(model)).toBe(false);

    const updatedState = applyAppActionToState(appState, checkboxUIModelSetValue(model, true));
    const updatedModel = getUIModelByPathAndCheckType(updatedState.uiModel, uiPath, 'checkbox');
    // 入力した値に変化している
    expect(checkboxUIModelValue(updatedModel)).toBe(true);
  });

  it('マッピングテーブル内のテキスト入力ができる', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [
      ['tab'],
      ['contentList'],
      ['form', 'mappingTable'],
      ['mappingTable', 'a', 'singleLineText'],
    ];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'text');
    // 初期値は入ってないので、空文字が表示される
    expect(model.value).toBe('');

    const updatedState = applyAppActionToState(appState, textUIModelSetText(model, 'changed'));
    const updatedModel = getUIModelByPathAndCheckType(updatedState.uiModel, uiPath, 'text');
    // 入力した値に変化している
    expect(updatedModel.value).toBe('changed');
  });

  it('マッピングテーブルにペーストができる(やや複雑なパターン)', async () => {
    const appState = await initAppState();
    const uiPath: UIModelPath = [['tab'], ['contentList'], ['form', 'mappingTable']];
    const model = getUIModelByPathAndCheckType(appState.uiModel, uiPath, 'mappingTable');
    const root = {model: appState.data, schema: appState.uiSchema?.dataSchema};
    const paste = mappingTableUIModelPaste(
      model,
      {row: {start: 0, size: 1}, col: {start: 0, size: 1}},
      [
        ['A', ''],
        ['B', '1'],
        ['', '2'],
      ],
      root,
    );
    const updatedState = applyAppActionToState(appState, paste!.action);
    const updatedModel = getUIModelByPathAndCheckType(updatedState.uiModel, uiPath, 'mappingTable');
    // pasteした値は3行だが、mapping元のデータが2行なのでこちらも2行のまま
    expect(updatedModel.rows.length).toBe(2);
    // 無効な行も発生しない
    expect(updatedModel.danglingRows.length).toBe(0);

    // 結果が下記になっているはず
    // | A |   |
    // | B | 1 |
    expect(getUIModelByPathAndCheckType(updatedModel, [['mappingTable', 'a', 'singleLineText']], 'text').value).toBe(
      'A',
    );
    expect(getUIModelByPathAndCheckType(updatedModel, [['mappingTable', 'a', 'multiLineText']], 'text').value).toBe('');
    expect(getUIModelByPathAndCheckType(updatedModel, [['mappingTable', 'b', 'singleLineText']], 'text').value).toBe(
      'B',
    );
    expect(getUIModelByPathAndCheckType(updatedModel, [['mappingTable', 'b', 'multiLineText']], 'text').value).toBe(
      '1',
    );
  });
});
