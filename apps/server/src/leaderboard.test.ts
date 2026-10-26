import type { LeaderboardResponse, StartRoundResponse } from '@glowcatch/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from './index';
import { startRound } from './rounds';
import { submitScore } from './score';
import { playRound } from './test/play';
import { playerInfo, signPlayerInfo } from './test/sign';

async function leaderboard(query = '') {
  const res = await worker.fetch(new Request(`https://api.test/v1/leaderboard${query}`), env);
  return { res, body: res.status === 200 ? await res.json<LeaderboardResponse>() : null };
}

/** Players with these best scores; each later one reached it later. */
async function seed(bests: Record<string, number>) {
  const rows = Object.entries(bests);
  await env.DB.batch(
    rows.map(([id, best], i) =>
      env.DB.prepare(
        'INSERT INTO players (id, best_score, best_at, updated_at) VALUES (?1, ?2, ?3, ?4)',
      ).bind(id, best, best > 0 ? 1000 + i : null, 1000 + i),
    ),
  );
}

describe('GET /v1/leaderboard', () => {
  it('is empty before anyone has a best', async () => {
    await seed({ newcomer: 0 });
    const { res, body } = await leaderboard('?player=newcomer');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({ top: [], player: null });
  });

  it('lists the top 10 by best: ties share a place, and the first to get there lists first', async () => {
    await seed({
      p1: 300,
      // Both on 250: zoe got there first, so lists first, though abe sorts first by ID.
      zoe: 250,
      abe: 250,
      p4: 200,
      p5: 180,
      p6: 150,
      p7: 120,
      p8: 100,
      p9: 90,
      p10: 80,
      p11: 70,
      zero: 0,
    });
    const { body } = await leaderboard();

    expect(body!.top.map((row) => [row.rank, row.playerId, row.score])).toEqual([
      [1, 'p1', 300],
      [2, 'zoe', 250],
      [2, 'abe', 250],
      [4, 'p4', 200],
      [5, 'p5', 180],
      [6, 'p6', 150],
      [7, 'p7', 120],
      [8, 'p8', 100],
      [9, 'p9', 90],
      [10, 'p10', 80],
    ]);
    expect(body!.player).toBeNull();
  });

  it("gives the asking player's own row, in the top 10 or not", async () => {
    await seed(
      Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`p${i + 1}`, 500 - i * 10])),
    );

    expect((await leaderboard('?player=p12')).body!.player).toEqual({
      rank: 12,
      playerId: 'p12',
      score: 390,
    });
    expect((await leaderboard('?player=p3')).body!.player).toEqual({
      rank: 3,
      playerId: 'p3',
      score: 480,
    });
    expect((await leaderboard('?player=stranger')).body!.player).toBeNull();
  });

  it('refuses a player ID that could never be one', async () => {
    for (const query of ['?player=', '?player=has%20space', `?player=${'9'.repeat(65)}`]) {
      const { res } = await leaderboard(query);
      expect(res.status, query).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request' });
    }
  });

  it('shows a ranked round as soon as it is scored', async () => {
    const at = Date.now() - 60_000;
    const field = { width: 390, height: 844, top: 96 };
    const start = new Request('https://api.test/v1/rounds', {
      method: 'POST',
      body: JSON.stringify({ signature: await signPlayerInfo(playerInfo('42', null, at)), field }),
    });
    const round = await (await startRound(start, env, at)).json<StartRoundResponse>();
    const played = playRound({ seed: round.seed, field });
    const signature = await signPlayerInfo(playerInfo('42', round.roundId));
    const submit = new Request(`https://api.test/v1/rounds/${round.roundId}/score`, {
      method: 'POST',
      body: JSON.stringify({ signature, taps: played.taps, score: played.score }),
    });
    expect((await submitScore(submit, env, round.roundId, Date.now())).status).toBe(200);

    const mine = { rank: 1, playerId: '42', score: played.score };
    expect((await leaderboard('?player=42')).body).toEqual({ top: [mine], player: mine });
  });
});
