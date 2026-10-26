// GET /v1/leaderboard?player={playerId}: the top 10 by best score, and where the
// asking player stands. Player IDs and scores only; the game turns IDs into
// names and photos through Facebook's overlay view (D11).

import type { LeaderboardResponse, LeaderboardRow } from '@glowcatch/shared';
import type { Env } from './env';
import { fail, json } from './http';
import { isPlayerId } from './player';

export const LEADERBOARD_SIZE = 10;

// A player's place: one more than the players with a higher best, so tied
// scores share a place.
const RANKED = `SELECT id AS playerId, best_score AS score,
  (SELECT COUNT(*) + 1 FROM players AS other WHERE other.best_score > me.best_score) AS rank
  FROM players AS me`;

export async function getLeaderboard(url: URL, env: Env): Promise<Response> {
  const playerId = url.searchParams.get('player');
  if (playerId !== null && !isPlayerId(playerId)) return fail(400, 'bad_request');

  const [top, player] = await env.DB.batch<LeaderboardRow>([
    env.DB.prepare(
      `${RANKED} WHERE best_score > 0 ORDER BY best_score DESC, best_at ASC, id ASC LIMIT ?1`,
    ).bind(LEADERBOARD_SIZE),
    env.DB.prepare(`${RANKED} WHERE id = ?1 AND best_score > 0`).bind(playerId ?? ''),
  ]);
  const body: LeaderboardResponse = { top: top!.results, player: player!.results[0] ?? null };
  return json(body, 200, { 'cache-control': 'no-store' });
}
