import { facebookPlatform } from './fbinstant';
import { localPlatform } from './local';

/** What the game needs from wherever it runs: Facebook, or a plain browser tab. */
export interface Platform {
  readonly kind: PlatformKind;
  initialize(): Promise<void>;
  /** 0–100; Facebook shows it on its own loading screen. */
  setLoadingProgress(percent: number): void;
  /** Hides Facebook's loading screen. Call once the title can render. */
  start(): Promise<void>;
  /** Facebook's own pause: the player switched apps or tabs. */
  onPause(callback: () => void): void;
  /**
   * Opens the share dialog. Resolves when it closes, whether or not the player
   * shared: cancelling isn't an error. Rejects only if sharing couldn't open.
   */
  share(payload: SharePayload): Promise<void>;
}

export interface SharePayload {
  /** A data URL of a PNG. */
  image: string;
  text: string;
  data?: Record<string, unknown>;
}

export type PlatformKind = 'facebook' | 'local';

export function detectPlatform(): Platform {
  const sdk = window.FBInstant;
  const kind = choosePlatform({
    hasSdk: sdk !== undefined,
    // Facebook always runs the game in an iframe; a top-level tab is local dev.
    embedded: window.self !== window.top,
    forced: new URLSearchParams(window.location.search).get('platform'),
  });
  return kind === 'facebook' && sdk ? facebookPlatform(sdk) : localPlatform();
}

/** `?platform=local` or `?platform=facebook` overrides the guess. */
export function choosePlatform(env: {
  hasSdk: boolean;
  embedded: boolean;
  forced: string | null;
}): PlatformKind {
  if (!env.hasSdk || env.forced === 'local') return 'local';
  return env.forced === 'facebook' || env.embedded ? 'facebook' : 'local';
}
