// Rules and round simulation shared by the game (apps/game) and the server
// (apps/server). Both import them from here, so they can't disagree on a score.
// No DOM, no Node APIs: this code runs in the browser and in a Worker.

/** Bumped whenever a rule change would replay an existing round differently. */
export const RULES_VERSION = 1;

export * from './rules';
export * from './random';
export * from './curves';
export * from './simulation';
export type * from './api';
