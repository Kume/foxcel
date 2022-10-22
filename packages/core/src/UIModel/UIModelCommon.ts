import {AppAction} from '../App/AppState';

export interface UIModelContextMenuItem {
  readonly label: string;
  readonly action: AppAction;
}
