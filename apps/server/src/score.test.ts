import {
  MAX_ROUND_TICKS,
  type StartRoundResponse,
  type SubmitScoreResponse,
  type Tap,
} from '@glowcatch/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from './index';
import { ROUND_TTL_MS, startRound } from './rounds';
import { MAX_TAPS } from './score';
import { playRound, type Played } from './test/play';
import { playerInfo, signPlayerInfo } from './test/sign';

const field = { width: 390, height: 844, top: 96 };

/** Starts a round for `playerId` as if `ago` ms ago, so it has had time to be played. */
async function startAgo(playerId: string, ago = 60_000): Promise<StartRoundResponse> {
  const at = Date.now() - ago;
  const signature = await signPlayerInfo(playerInfo(playerId, null, at));
  const request = new Request('https://api.test/v1/rounds', {
    method: 'POST',
    body: JSON.stringify({ signature, field }),
  });
  const res = await startRound(request, env, at);
  expect(res.status).toBe(201);
  return res.json<StartRoundResponse>();
}

/** A started round, played through by a human-paced player. */
async function playedRound(playerId = '101', ago = 60_000, pace?: Parameters<typeof playRound>[1]) {
  const round = await startAgo(playerId, ago);
  return { round, played: playRound({ seed: round.seed, field }, pace) };
}

interface Submission {
  taps: Tap[];
  score: number;
  /** Who signs, and what they sign: by default the round's player, for this round. */
  playerId?: string;
  payload?: string | null;
}

async function submit(
  round: StartRoundResponse,
  { playerId = '101', payload, ...body }: Submission,
) {
  const signature = await signPlayerInfo(
    playerInfo(playerId, payload === undefined ? round.roundId : payload),
  );
  return worker.fetch(
    new Request(`https://api.test/v1/rounds/${round.roundId}/score`, {
      method: 'POST',
      body: JSON.stringify({ signature, ...body }),
    }),
    env,
  );
}

async function submitPlayed(
  round: StartRoundResponse,
  played: Played,
  extra: Partial<Submission> = {},
) {
  const res = await submit(round, { taps: played.taps, score: played.score, ...extra });
  expect(res.status).toBe(200);
  return res.json<SubmitScoreResponse>();
}

const stored = (roundId: string) =>
  env.DB.prepare('SELECT status, reject_reason, score FROM rounds WHERE id = ?1')
    .bind(roundId)
    .first();
const bestOf = (playerId: string) =>
  env.DB.prepare('SELECT best_score, best_at FROM players WHERE id = ?1').bind(playerId).first();

describe('POST /v1/rounds/{roundId}/score', () => {
  it('ranks a round the replay agrees with, and keeps its taps', async () => {
    const { round, played } = await playedRound();
    expect(played.score).toBeGreaterThan(0);
    const before = Date.now();

    expect(await submitPlayed(round, played)).toEqual({
      status: 'ranked',
      score: played.score,
      best: played.score,
      rank: 1,
    });
    const row = await env.DB.prepare('SELECT * FROM rounds WHERE id = ?1')
      .bind(round.roundId)
      .first();
    expect(row).toMatchObject({ status: 'ranked', reject_reason: null, score: played.score });
    expect(JSON.parse(row!.taps as string)).toEqual(played.taps);
    expect(row!.submitted_at).toBeGreaterThanOrEqual(before);
    expect(await bestOf('101')).toMatchObject({ best_score: played.score });
  });

  it("doesn't rank a score the replay can't reproduce", async () => {
    const { round, played } = await playedRound();

    expect(await submitPlayed(round, played, { score: played.score + 10 })).toEqual({
      status: 'unranked',
      score: played.score,
      best: 0,
      rank: null,
    });
    expect(await stored(round.roundId)).toMatchObject({
      status: 'rejected',
      reject_reason: 'mismatch',
    });
  });

  it('answers a repeat submission with the first answer, changing nothing', async () => {
    const { round, played } = await playedRound();
    const first = await submitPlayed(round, played);

    expect(await submitPlayed(round, played, { score: played.score + 10 })).toEqual(first);
    expect(await submitPlayed(round, { ...played, taps: [] }, { score: 0 })).toEqual(first);
    expect(await stored(round.roundId)).toMatchObject({ status: 'ranked', score: played.score });
  });

  it('takes one of two submissions sent at once, and gives both its answer', async () => {
    // Either order: the second log must not overwrite the round or lift the best.
    for (const [playerId, highFirst] of [
      ['101', true],
      ['202', false],
    ] as const) {
      const { round, played } = await playedRound(playerId);
      const high = { taps: played.taps, score: played.score, playerId };
      const low = { taps: [], score: 0, playerId };
      const responses = await Promise.all(
        (highFirst ? [high, low] : [low, high]).map((body) => submit(round, body)),
      );
      const [a, b] = await Promise.all(responses.map((res) => res.json<SubmitScoreResponse>()));
      const row = await stored(round.roundId);

      expect(a).toEqual(b);
      expect(a!.score).toBe(row!.score);
      expect(await bestOf(playerId)).toMatchObject({ best_score: row!.score });
    }
  });

  it('keeps the best score, and ranks players by it, ties sharing a place', async () => {
    const { round, played } = await playedRound();
    await submitPlayed(round, played);
    const second = await startAgo('101');

    // A worse round is still ranked, but the best stays.
    expect(await submitPlayed(second, { taps: [], score: 0, ticks: 0 })).toEqual({
      status: 'ranked',
      score: 0,
      best: played.score,
      rank: 1,
    });

    const top = played.score + 100;
    await env.DB.prepare(
      'INSERT INTO players (id, best_score, best_at, updated_at) VALUES (?1, ?3, 1, 1), (?2, ?3, 1, 1), (?4, ?5, 1, 1)',
    )
      .bind('a', 'b', top, 'c', played.score)
      .run();
    const third = await startAgo('101');
    expect(await submitPlayed(third, { taps: [], score: 0, ticks: 0 })).toMatchObject({
      best: played.score,
      rank: 3,
    });
  });

  it("doesn't rank a round sent back sooner than it can be played", async () => {
    const { round, played } = await playedRound('101', 10_000);

    expect(await submitPlayed(round, played)).toMatchObject({ status: 'unranked', best: 0 });
    expect(await stored(round.roundId)).toMatchObject({ reject_reason: 'too_fast' });
  });

  it("doesn't rank an expired round, or one a newer round closed", async () => {
    const expired = await playedRound('101', ROUND_TTL_MS + 60_000);
    expect(await submitPlayed(expired.round, expired.played)).toEqual({
      status: 'unranked',
      score: null,
      best: 0,
      rank: null,
    });
    expect(await stored(expired.round.roundId)).toMatchObject({ reject_reason: 'expired' });

    const closed = await playedRound('202');
    await startAgo('202');
    expect(await submitPlayed(closed.round, closed.played, { playerId: '202' })).toMatchObject({
      status: 'unranked',
      score: null,
    });
    expect(await stored(closed.round.roundId)).toMatchObject({ reject_reason: 'superseded' });
  });

  it("doesn't rank a round played under other rules", async () => {
    const { round, played } = await playedRound();
    await env.DB.prepare('UPDATE rounds SET rules_version = 0 WHERE id = ?1')
      .bind(round.roundId)
      .run();

    expect(await submitPlayed(round, played)).toMatchObject({ status: 'unranked', score: null });
    expect(await stored(round.roundId)).toMatchObject({ reject_reason: 'rules_version' });
  });

  it("doesn't rank taps logged after the round ended", async () => {
    const { round, played } = await playedRound();
    const late = [...played.taps, { tick: played.ticks, x: 10, y: 10 }];

    expect(await submitPlayed(round, played, { taps: late })).toMatchObject({ status: 'unranked' });
    expect(await stored(round.roundId)).toMatchObject({ reject_reason: 'late_taps' });
  });

  it("doesn't rank catches no person could make", async () => {
    const { round, played } = await playedRound('101', 60_000, { reactionMs: 0, gapMs: 0 });

    expect(await submitPlayed(round, played)).toMatchObject({ status: 'unranked' });
    expect(await stored(round.roundId)).toMatchObject({ reject_reason: 'reaction' });
  });

  it("doesn't rank more taps a second than fingers manage", async () => {
    const { round, played } = await playedRound();
    // Thirty misses in a third of a second, in the sky above the play area.
    const burst = Array.from({ length: 30 }, (_, i) => ({ tick: 1000 + i, x: 5, y: 5 }));
    const taps = [...played.taps, ...burst].sort((a, b) => a.tick - b.tick);

    expect(await submitPlayed(round, played, { taps })).toMatchObject({ status: 'unranked' });
    expect(await stored(round.roundId)).toMatchObject({ reject_reason: 'tap_rate' });
  });

  it('needs a fresh signature made for this round, by its player', async () => {
    const { round, played } = await playedRound();
    const body = { taps: played.taps, score: played.score };

    for (const payload of [null, crypto.randomUUID()]) {
      expect((await submit(round, { ...body, payload })).status).toBe(401);
    }
    expect((await submit(round, { ...body, playerId: '202' })).status).toBe(404);
    expect((await submit({ ...round, roundId: crypto.randomUUID() }, body)).status).toBe(404);
    expect(await stored(round.roundId)).toMatchObject({ status: 'issued' });
  });

  it("refuses a body it can't replay, and leaves the round open", async () => {
    const { round, played } = await playedRound();
    const tap = { tick: 10, x: 50, y: 50 };
    const bodies: unknown[] = [
      { taps: played.taps },
      { score: 0 },
      { taps: 'none', score: 0 },
      { taps: played.taps, score: -1 },
      { taps: played.taps, score: 1.5 },
      { taps: [{ ...tap, tick: 10.5 }], score: 0 },
      { taps: [{ ...tap, tick: -1 }], score: 0 },
      { taps: [{ ...tap, tick: MAX_ROUND_TICKS + 1 }], score: 0 },
      { taps: [{ ...tap, x: '50' }], score: 0 },
      { taps: [{ ...tap, y: 1e9 }], score: 0 },
      { taps: [{ tick: 10, x: 50 }], score: 0 },
      { taps: [{ ...tap, tick: 20 }, tap], score: 0 },
      { taps: Array.from({ length: MAX_TAPS + 1 }, () => tap), score: 0 },
    ];
    const signature = await signPlayerInfo(playerInfo('101', round.roundId));

    for (const body of bodies) {
      const res = await worker.fetch(
        new Request(`https://api.test/v1/rounds/${round.roundId}/score`, {
          method: 'POST',
          body: JSON.stringify({ signature, ...(body as object) }),
        }),
        env,
      );
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
    expect(await stored(round.roundId)).toMatchObject({ status: 'issued' });
  });

  it('is only at POST /v1/rounds/{a round ID}/score', async () => {
    const { round } = await playedRound();
    for (const request of [
      new Request(`https://api.test/v1/rounds/${round.roundId}/score`),
      new Request('https://api.test/v1/rounds/not-a-round/score', { method: 'POST', body: '{}' }),
    ]) {
      expect((await worker.fetch(request, env)).status).toBe(404);
    }
  });
});
