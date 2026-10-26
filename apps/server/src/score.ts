// POST /v1/rounds/{roundId}/score: the finished round. The server replays the
// taps from the round's seed and keeps its own score; the score the game claims
// only has to agree with it (D6, docs/backend/trust-model.md).

import {
  MAX_ROUND_TICKS,
  replayRound,
  RULES_VERSION,
  TICK_MS,
  type SubmitScoreRequest,
  type SubmitScoreResponse,
  type Tap,
} from '@glowcatch/shared';
import type { Env } from './env';
import { fail, json, readJson } from './http';
import { implausibility, type Implausible } from './plausibility';
import { identify } from './player';

/** More taps than a round can hold: 25 a second for the longest round. */
export const MAX_TAPS = 1000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_COORDINATE = 100_000;
/** Slack for the clock check: a round can't come back sooner than it takes to play. */
const CLOCK_SLACK_MS = 1000;

/** Why a round wasn't ranked. Stored with it and logged; never shown to the player. */
export type RejectReason =
  'superseded' | 'expired' | 'rules_version' | 'late_taps' | 'mismatch' | 'too_fast' | Implausible;

interface RoundRow {
  id: string;
  player_id: string;
  seed: number;
  rules_version: number;
  field_w: number;
  field_h: number;
  field_top: number;
  issued_at: number;
  expires_at: number;
  score: number | null;
  status: 'issued' | 'ranked' | 'rejected';
}

export async function submitScore(
  request: Request,
  env: Env,
  roundId: string,
  now: number,
): Promise<Response> {
  const body = await readJson(request, MAX_BODY_BYTES);
  if (!isSubmitScoreRequest(body)) return fail(400, 'bad_request');
  const check = await identify(body.signature, env, new URL(request.url), now);
  // The signature must name this round, so it can't be reused for another.
  if (!check.ok || check.player.requestPayload !== roundId) {
    console.warn('submit score: unauthorized', check.ok ? 'request_payload' : check.reason);
    return fail(401, 'unauthorized');
  }
  const playerId = check.player.id;
  const round = await findRound(env, roundId);
  if (!round || round.player_id !== playerId) return fail(404, 'not_found');

  // Already decided, by an earlier submission whose answer was lost or by a
  // newer round: the same answer again, and nothing changes.
  if (round.status !== 'issued') return json(await answer(env, round));

  const taps = body.taps.map(({ tick, x, y }) => ({ tick, x, y }));
  const { score, reason } = judge(round, taps, body.score, now);
  const status = reason ? 'rejected' : 'ranked';
  const statements = [
    env.DB.prepare(
      `UPDATE rounds SET submitted_at = ?1, taps = ?2, score = ?3, status = ?4, reject_reason = ?5
       WHERE id = ?6 AND status = 'issued'`,
    ).bind(now, JSON.stringify(taps), score, status, reason, roundId),
  ];
  if (status === 'ranked') {
    // Only if this request's result was the one stored: a second submission
    // racing this one can't lift the best with a different tap log.
    statements.push(
      env.DB.prepare(
        `UPDATE players SET best_score = ?1, best_at = ?2, updated_at = ?2
         WHERE id = ?3 AND best_score < ?1 AND EXISTS (
           SELECT 1 FROM rounds WHERE id = ?4 AND status = 'ranked' AND score = ?1 AND submitted_at = ?2
         )`,
      ).bind(score, now, playerId, roundId),
    );
  }
  await env.DB.batch(statements);
  if (reason) console.log('round not ranked', roundId, reason);
  return json(await answer(env, (await findRound(env, roundId))!));
}

function judge(
  round: RoundRow,
  taps: Tap[],
  claimed: number,
  now: number,
): { score: number | null; reason: RejectReason | null } {
  if (now > round.expires_at) return { score: null, reason: 'expired' };
  // The rules changed since the round was issued, so it can't be replayed as played.
  if (round.rules_version !== RULES_VERSION) return { score: null, reason: 'rules_version' };

  const field = { width: round.field_w, height: round.field_h, top: round.field_top };
  const replay = replayRound({ seed: round.seed, field }, taps);
  const { score } = replay;
  // The game never logs a tap after the end, and it runs the same simulation,
  // so an honest round has no late taps and claims exactly the replayed score.
  if (replay.lateTaps > 0) return { score, reason: 'late_taps' };
  if (claimed !== score) return { score, reason: 'mismatch' };
  // Every tick is 10 ms of the player's time, frozen ones included.
  if (now - round.issued_at < replay.ticks * TICK_MS - CLOCK_SLACK_MS) {
    return { score, reason: 'too_fast' };
  }
  return { score, reason: implausibility(replay.catches, taps) };
}

/** The round's outcome, with the player's best and place as they stand now. */
async function answer(env: Env, round: RoundRow): Promise<SubmitScoreResponse> {
  const player = await env.DB.prepare(
    `SELECT best_score AS best,
       (SELECT COUNT(*) + 1 FROM players AS other WHERE other.best_score > me.best_score) AS rank
     FROM players AS me WHERE id = ?1`,
  )
    .bind(round.player_id)
    .first<{ best: number; rank: number }>();
  const best = player?.best ?? 0;
  return {
    status: round.status === 'ranked' ? 'ranked' : 'unranked',
    score: round.score,
    best,
    rank: best > 0 ? player!.rank : null,
  };
}

function findRound(env: Env, roundId: string): Promise<RoundRow | null> {
  return env.DB.prepare('SELECT * FROM rounds WHERE id = ?1').bind(roundId).first<RoundRow>();
}

function isSubmitScoreRequest(body: unknown): body is SubmitScoreRequest {
  if (typeof body !== 'object' || body === null) return false;
  const { signature, taps, score } = body as Record<string, unknown>;
  return (
    typeof signature === 'string' &&
    signature.length <= 2048 &&
    Number.isSafeInteger(score) &&
    (score as number) >= 0 &&
    isTapLog(taps)
  );
}

/** Taps in tick order, each within the longest round, at a finite place. */
function isTapLog(value: unknown): value is Tap[] {
  if (!Array.isArray(value) || value.length > MAX_TAPS) return false;
  let last = 0;
  for (const tap of value) {
    if (typeof tap !== 'object' || tap === null) return false;
    const { tick, x, y } = tap as Record<string, unknown>;
    if (!Number.isInteger(tick)) return false;
    const t = tick as number;
    if (t < last || t > MAX_ROUND_TICKS || !isCoordinate(x) || !isCoordinate(y)) return false;
    last = t;
  }
  return true;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) <= MAX_COORDINATE;
}
