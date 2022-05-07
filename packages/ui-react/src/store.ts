import {combineReducers, createStore} from 'redux';
import {dataEditorReducer} from './dataEditor/dataEditorReducer';

export const store = createStore(combineReducers({dataEditor: dataEditorReducer}));
