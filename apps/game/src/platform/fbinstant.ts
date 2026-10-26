import type { Platform, SharePayload } from './platform';

// The slice of the Instant Games SDK (v8.0) the game uses. The SDK is a global
// script from Facebook's CDN (see index.html), not an npm package, so these
// types are written by hand and grow as the game uses more of it.
export interface FBInstantSDK {
  initializeAsync(): Promise<void>;
  setLoadingProgress(percentage: number): void;
  startGameAsync(): Promise<void>;
  onPause(callback: () => void): void;
  shareAsync(payload: SharePayload & { intent: 'SHARE' }): Promise<void>;
}

declare global {
  interface Window {
    FBInstant?: FBInstantSDK;
  }
}

export function facebookPlatform(sdk: FBInstantSDK): Platform {
  return {
    kind: 'facebook',
    initialize: () => sdk.initializeAsync(),
    setLoadingProgress: (percent) => sdk.setLoadingProgress(percent),
    start: () => sdk.startGameAsync(),
    onPause: (callback) => sdk.onPause(callback),
    share: (payload) => sdk.shareAsync({ intent: 'SHARE', ...payload }),
  };
}
