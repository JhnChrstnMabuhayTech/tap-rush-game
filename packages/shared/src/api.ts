// The JSON the game and the server exchange (docs/backend/README.md). The
// game's API client and the server's handlers both use these types, so the two
// can't drift apart.

import type { Field, Tap } from './simulation';

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

/** `POST /v1/rounds/{roundId}/score`: the finished round, for the server to replay. */
export interface SubmitScoreRequest {
  /** From `getSignedPlayerInfoAsync(roundId)`: signed for this round. */
  signature: string;
  /** Every tap, as `Round.taps` logged them. */
  taps: Tap[];
  /** The score the game showed. The server replays the taps and keeps its own. */
  score: number;
}

export interface SubmitScoreResponse {
  /** `unranked`: kept on the device but not on the leaderboard ("Score not ranked this round."). */
  status: 'ranked' | 'unranked';
  /** The server's score for the round, or null if it wasn't replayed. */
  score: number | null;
  /** The player's best ranked score; 0 before their first. */
  best: number;
  /** The player's place by best score (ties share a place), or null without a best. */
  rank: number | null;
}

export type ApiErrorCode = 'bad_request' | 'unauthorized' | 'not_found';

/** Every error response: a status code, and this body. */
export interface ApiError {
  error: ApiErrorCode;
}
