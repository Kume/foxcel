import React from 'react';

export function preventDefaultCallback(e: React.MouseEvent<HTMLElement>) {
  e.preventDefault();
}
