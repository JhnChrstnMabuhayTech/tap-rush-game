import { RULES_VERSION } from '@glowcatch/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from './index';

describe('GET /health', () => {
  it('answers ok with the rules version it replays', async () => {
    const res = await worker.fetch(new Request('https://api.test/health'), env);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true, rulesVersion: RULES_VERSION });
  });
});

describe('unknown routes', () => {
  it('answer 404 as JSON', async () => {
    for (const request of [
      new Request('https://api.test/nope'),
      new Request('https://api.test/v1/rounds'),
      new Request('https://api.test/health', { method: 'POST' }),
      new Request('https://api.test/v1/leaderboard', { method: 'POST' }),
    ]) {
      const res = await worker.fetch(request, env);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
  });
});

describe('requests per IP', () => {
  const from = (ip: string, path = '/v1/leaderboard') =>
    worker.fetch(
      new Request(`https://api.test${path}`, { headers: { 'cf-connecting-ip': ip } }),
      env,
    );

  it('are limited across the API, and the limit says when to come back', async () => {
    // The limiter counts in fixed one-minute windows, so allow for this test
    // straddling two of them: it then takes up to twice the limit.
    let allowed = 0;
    let limited: Response | undefined;
    while (!limited && allowed <= 600) {
      const res = await from('203.0.113.7');
      if (res.status === 429) limited = res;
      else allowed++;
    }

    expect(allowed).toBeGreaterThanOrEqual(300);
    expect(limited?.headers.get('retry-after')).toBe('60');
    expect(await limited?.json()).toEqual({ error: 'rate_limited' });
    expect((await from('203.0.113.7', '/v1/rounds')).status).toBe(429);
    expect((await from('203.0.113.8')).status).toBe(200);
    expect((await from('203.0.113.7', '/health')).status).toBe(200);
  });
});
