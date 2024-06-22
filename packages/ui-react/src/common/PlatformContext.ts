import React from 'react';

export interface PlatformContextProps {
  platform: 'apple' | 'windows' | 'linux' | undefined;
}

export function guessPlatformByUserAgent(ua: string): PlatformContextProps['platform'] {
  if (ua.includes('Windows NT')) {
    return 'windows';
  } else if (ua.includes('Mac OS X')) {
    return 'apple';
  } else {
    return 'linux';
  }
}

export const PlatformContext = React.createContext<PlatformContextProps | undefined>(undefined);
