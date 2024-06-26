import React from 'react';

export const KeyValue_Enter = 'Enter';
export const KeyValue_Backspace = 'Backspace';
export const KeyValue_Delete = 'Delete';
export const KeyValue_Tab = 'Tab';
export const KeyValue_ArrowUp = 'ArrowUp';
export const KeyValue_ArrowRight = 'ArrowRight';
export const KeyValue_ArrowDown = 'ArrowDown';
export const KeyValue_ArrowLeft = 'ArrowLeft';
export const KeyValue_Escape = 'Escape';

export function withShiftKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
}

export function withAltKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return !e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey;
}

export function withCtrlKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return !e.shiftKey && !e.altKey && e.ctrlKey && !e.metaKey;
}

export function withMetaKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return !e.shiftKey && !e.altKey && !e.ctrlKey && e.metaKey;
}

export function withoutModifierKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
}
