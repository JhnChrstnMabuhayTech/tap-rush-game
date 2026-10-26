// The JSON the game and the server exchange (docs/backend/README.md). The
// game's API client and the server's handlers both use these types, so the two
// can't drift apart.

import type { Field } from './simulation';

/** `POST /v1/rounds`: ask for a round to play. */
export interface StartRoundRequest {
  /** From `FBInstant.player.getSignedPlayerInfoAsync()`. */
  signature: string;
  /** The play frame the round is set up for. */
  field: Field;
}

export interface StartRoundResponse {
  roundId: string;
  /** The round's seed, chosen by the server. */
  seed: number;
  rulesVersion: number;
  /** Milliseconds since the epoch. A score submitted later isn't ranked. */
  expiresAt: number;
}

export type ApiErrorCode = 'bad_request' | 'unauthorized' | 'not_found';

/** Every error response: a status code, and this body. */
export interface ApiError {
  error: ApiErrorCode;
}
