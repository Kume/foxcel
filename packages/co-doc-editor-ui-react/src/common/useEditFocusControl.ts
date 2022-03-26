import React, {useCallback, useEffect, useState} from 'react';

export interface EditFocusCallbacks {
  readonly onPaste?: (data: string) => boolean;
  readonly onCopy?: () => string | undefined;
  readonly onCut?: () => string | undefined;
  readonly onLostFocus?: () => void;
}

export interface EditFocusControl {
  startFocus: () => void;
}

export function useEditFocusControl(
  rootRef: React.RefObject<HTMLElement>,
  callbacks: EditFocusCallbacks,
): EditFocusControl {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  useEffect(() => {
    if (isFocused) {
      const {onPaste, onCopy, onCut, onLostFocus} = callbacks;
      const paste =
        onPaste &&
        ((e: ClipboardEvent) => {
          if (e.clipboardData) {
            const needsPreventDefault = onPaste(e.clipboardData.getData('text'));
            if (needsPreventDefault) {
              e.preventDefault();
            }
          }
        });
      if (paste) {
        document.addEventListener('paste', paste);
      }

      const copy =
        onCopy &&
        ((e: ClipboardEvent) => {
          if (e.clipboardData) {
            const data = onCopy();
            if (data !== undefined) {
              e.preventDefault();
              e.clipboardData.setData('text/plain', data);
            }
          }
        });
      if (copy) {
        document.addEventListener('copy', copy);
      }

      const cut =
        onCut &&
        ((e: ClipboardEvent) => {
          if (e.clipboardData) {
            const data = onCut();
            if (data !== undefined) {
              e.preventDefault();
              e.clipboardData.setData('text', data);
            }
          }
        });
      if (cut) {
        document.addEventListener('cut', cut);
      }

      const mouseDown =
        onLostFocus &&
        ((e: MouseEvent) => {
          if (e.target instanceof HTMLElement && !rootRef.current?.contains(e.target)) {
            onLostFocus();
            setIsFocused(false);
          }
        });
      if (mouseDown) {
        document.addEventListener('mousedown', mouseDown);
      }

      return () => {
        if (paste) {
          document.removeEventListener('paste', paste);
        }
        if (copy) {
          document.removeEventListener('copy', copy);
        }
        if (cut) {
          document.removeEventListener('cut', cut);
        }
        if (mouseDown) {
          document.removeEventListener('mousedown', mouseDown);
        }
      };
    } else {
      return undefined;
    }
    // isFocusedがtrue変更されたときのみ実行する意図なので、depsはisFocusedのみが正解
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
  const startFocus = useCallback(() => setIsFocused(true), []);
  return {startFocus};
}
