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
    // The page's own visibilitychange handler covers switching tabs.
    onPause: () => {},
    share: async ({ image, text }) => {
      console.info(`Glowcatch: would share "${text}" with an image of ${image.length} characters.`);
    },
  };
}
