import type { Platform } from './platform';

// Stands in for the Instant Games SDK in a plain browser tab, where
// FBInstant.initializeAsync would never resolve.
export function localPlatform(): Platform {
  return {
    kind: 'local',
    initialize: async () => {
      console.info('Glowcatch: running outside Facebook, with a local stand-in for the SDK.');
    },
    setLoadingProgress: () => {},
    start: async () => {},
  };
}
