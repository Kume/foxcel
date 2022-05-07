import {useCallback, useEffect, useState} from 'react';

export function useMouseUpTracking(onMouseUp: (e: MouseEvent) => void): () => void {
  const [isTracking, setIsTracking] = useState(false);
  const startTracking = useCallback(() => setIsTracking(true), []);
  useEffect(() => {
    if (isTracking) {
      const mouseUp = (e: MouseEvent) => {
        onMouseUp(e);
        setIsTracking(false);
      };
      document.addEventListener('mouseup', mouseUp);
      return () => {
        document.removeEventListener('mouseup', mouseUp);
      };
    } else {
      return undefined;
    }
  }, [isTracking, onMouseUp]);
  return startTracking;
}
