import React from 'react';

export function callStopPropagation(e: React.BaseSyntheticEvent): void {
  e.stopPropagation();
}
