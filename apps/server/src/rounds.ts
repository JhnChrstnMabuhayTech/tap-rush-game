// POST /v1/rounds: a new round for the signed-in player. The server chooses
// the seed; the game plays the round and later sends its taps, which the server
// replays to work out the score (D6, docs/backend/trust-model.md).

import {
  RULES_VERSION,
  type Field,
  type StartRoundRequest,
  type StartRoundResponse,
} from '@glowcatch/shared';
import type { Env } from './env';
import { fail, json, readJson } from './http';
import { identify } from './player';

/** A round's score must arrive within this long of the round being issued. */
export const ROUND_TTL_MS = 15 * 60_000;
/** The play frame's sides, in CSS pixels, from the smallest phone to a large desktop window. */
export const FIELD_MIN = 100;
export const FIELD_MAX = 4096;
const MAX_BODY_BYTES = 4096;
/**
 * Rounds a player may start in a few minutes. A full round takes over 30 s, so
 * more means a script, or quitting again and again to fish for an easy seed.
 */
export const ROUND_STARTS_ALLOWED = 20;
export const ROUND_STARTS_WINDOW_MS = 5 * 60_000;

export async function startRound(request: Request, env: Env, now: number): Promise<Response> {
  const body = await readJson(request, MAX_BODY_BYTES);
  if (!isStartRoundRequest(body)) return fail(400, 'bad_request');
  const check = await identify(body.signature, env, new URL(request.url), now);
  if (!check.ok) {
    console.warn('start round: unauthorized', check.reason);
    return fail(401, 'unauthorized');
  }

  const playerId = check.player.id;
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM rounds WHERE player_id = ?1 AND issued_at > ?2',
  )
    .bind(playerId, now - ROUND_STARTS_WINDOW_MS)
    .first<number>('n');
  if ((recent ?? 0) >= ROUND_STARTS_ALLOWED) {
    console.warn('start round: rate limited', playerId);
    return fail(429, 'rate_limited', { 'retry-after': '60' });
  }

  const round: StartRoundResponse = {
    roundId: crypto.randomUUID(),
    seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
    rulesVersion: RULES_VERSION,
    expiresAt: now + ROUND_TTL_MS,
  };
  const { width, height, top } = body.field;
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO players (id, updated_at) VALUES (?1, ?2) ON CONFLICT (id) DO NOTHING',
    ).bind(playerId, now),
    // At most one open round per player: a new round closes the last one, so
    // nobody can hold several seeds and play only the kindest.
    env.DB.prepare(
      "UPDATE rounds SET status = 'rejected', reject_reason = 'superseded' WHERE player_id = ?1 AND status = 'issued'",
    ).bind(playerId),
    env.DB.prepare(
      `INSERT INTO rounds (id, player_id, seed, rules_version, field_w, field_h, field_top, issued_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(
      round.roundId,
      playerId,
      round.seed,
      round.rulesVersion,
      width,
      height,
      top,
      now,
      round.expiresAt,
    ),
  ]);
  return json(round, 201);
}

function isStartRoundRequest(body: unknown): body is StartRoundRequest {
  if (typeof body !== 'object' || body === null) return false;
  const { signature, field } = body as Record<string, unknown>;
  return typeof signature === 'string' && signature.length <= 2048 && isField(field);
}

/** A play frame the simulation can lay a round out in. */
export function isField(value: unknown): value is Field {
  if (typeof value !== 'object' || value === null) return false;
  const { width, height, top } = value as Record<string, unknown>;
  const side = (n: unknown): n is number =>
    typeof n === 'number' && n >= FIELD_MIN && n <= FIELD_MAX;
  return side(width) && side(height) && typeof top === 'number' && top >= 0 && top <= height / 2;
}
