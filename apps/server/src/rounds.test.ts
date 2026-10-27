import { RULES_VERSION, SEED_MAX, type StartRoundResponse } from '@glowcatch/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';
import { ROUND_STARTS_ALLOWED, ROUND_STARTS_WINDOW_MS, ROUND_TTL_MS, startRound } from './rounds';
import { encodePlayerInfo, playerInfo, signPlayerInfo } from './test/sign';

const field = { width: 390, height: 844, top: 96 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function post(body: string, url = 'https://api.test/v1/rounds', workerEnv: Env = env) {
  return worker.fetch(
    new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } }),
    workerEnv,
  );
}

async function start(playerId: string) {
  const res = await post(
    JSON.stringify({ signature: await signPlayerInfo(playerInfo(playerId)), field }),
  );
  expect(res.status).toBe(201);
  return res.json<StartRoundResponse>();
}

const count = (table: 'players' | 'rounds') =>
  env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>('n');
const statusOf = (roundId: string) =>
  env.DB.prepare('SELECT status, reject_reason FROM rounds WHERE id = ?1').bind(roundId).first();

describe('POST /v1/rounds', () => {
  it('issues a round with a seed for a signed-in player', async () => {
    const before = Date.now();
    const round = await start('101');

    expect(round.roundId).toMatch(UUID);
    expect(Number.isInteger(round.seed) && round.seed >= 0 && round.seed <= SEED_MAX).toBe(true);
    expect(round.rulesVersion).toBe(RULES_VERSION);
    expect(round.expiresAt).toBeGreaterThanOrEqual(before + ROUND_TTL_MS);
    expect(round.expiresAt).toBeLessThanOrEqual(Date.now() + ROUND_TTL_MS);
  });

  it('stores the round, and the player with no best yet', async () => {
    const round = await start('101');

    expect(
      await env.DB.prepare('SELECT * FROM rounds WHERE id = ?1').bind(round.roundId).first(),
    ).toMatchObject({
      player_id: '101',
      seed: round.seed,
      rules_version: RULES_VERSION,
      field_w: 390,
      field_h: 844,
      field_top: 96,
      expires_at: round.expiresAt,
      status: 'issued',
      submitted_at: null,
      score: null,
    });
    expect(
      await env.DB.prepare('SELECT best_score, best_at FROM players WHERE id = ?1')
        .bind('101')
        .first(),
    ).toEqual({
      best_score: 0,
      best_at: null,
    });
  });

  it('gives every round its own seed', async () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 5; i++) seeds.add((await start('101')).seed);

    expect(seeds.size).toBe(5);
  });

  it("closes the player's open round when they start another", async () => {
    const first = await start('101');
    const second = await start('101');

    expect(await statusOf(first.roundId)).toEqual({
      status: 'rejected',
      reject_reason: 'superseded',
    });
    expect(await statusOf(second.roundId)).toEqual({ status: 'issued', reject_reason: null });
    expect(await count('players')).toBe(1);
  });

  it('limits how many rounds a player can start in five minutes', async () => {
    const now = Date.now();
    const startAt = async (playerId: string, at: number) => {
      const signature = await signPlayerInfo(playerInfo(playerId, null, at));
      const request = new Request('https://api.test/v1/rounds', {
        method: 'POST',
        body: JSON.stringify({ signature, field }),
      });
      return startRound(request, env, at);
    };
    for (let i = 0; i < ROUND_STARTS_ALLOWED; i++) {
      expect((await startAt('101', now + i * 1000)).status).toBe(201);
    }

    const limited = await startAt('101', now + 30_000);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(await limited.json()).toEqual({ error: 'rate_limited' });
    expect(await count('rounds')).toBe(ROUND_STARTS_ALLOWED);

    expect((await startAt('202', now + 30_000)).status).toBe(201);
    expect((await startAt('101', now + ROUND_STARTS_WINDOW_MS + 1000)).status).toBe(201);
  });

  it("leaves other players' rounds open", async () => {
    const theirs = await start('202');
    await start('101');

    expect(await statusOf(theirs.roundId)).toEqual({ status: 'issued', reject_reason: null });
  });

  it('refuses a request without a valid signature, and stores nothing', async () => {
    const forged = await signPlayerInfo(playerInfo('101'), 'not-the-app-secret');
    const stale = await signPlayerInfo(playerInfo('101', null, Date.now() - 10 * 60_000));
    const unsigned = `unsigned.${encodePlayerInfo(playerInfo('101'))}`;

    for (const signature of [forged, stale, unsigned]) {
      const res = await post(JSON.stringify({ signature, field }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
    }
    expect(await count('rounds')).toBe(0);
    expect(await count('players')).toBe(0);
  });

  it('accepts unsigned requests in local development', async () => {
    const unsigned = `unsigned.${encodePlayerInfo(playerInfo('dev-player'))}`;
    const res = await post(
      JSON.stringify({ signature: unsigned, field }),
      'http://localhost:8787/v1/rounds',
      { ...env, ALLOW_UNSIGNED: 'true' },
    );

    expect(res.status).toBe(201);
  });

  it("refuses a body it can't use", async () => {
    const signature = await signPlayerInfo(playerInfo('101'));
    const bodies = [
      'not json',
      '{}',
      JSON.stringify({ signature }),
      JSON.stringify({ field }),
      JSON.stringify({ signature: 42, field }),
      JSON.stringify({ signature, field: { ...field, width: 50 } }),
      JSON.stringify({ signature, field: { ...field, height: 5000 } }),
      JSON.stringify({ signature, field: { ...field, width: '390' } }),
      JSON.stringify({ signature, field: { ...field, top: -1 } }),
      JSON.stringify({ signature, field: { ...field, top: 500 } }),
      JSON.stringify({ signature, field, padding: 'x'.repeat(5000) }),
    ];

    for (const body of bodies) {
      const res = await post(body);
      expect(res.status, body.slice(0, 80)).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request' });
    }
    expect(await count('rounds')).toBe(0);
  });
});
