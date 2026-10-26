import { RULES_VERSION } from '@glowcatch/shared';
import { describe, expect, it } from 'vitest';
import worker from './index';

const env = {};

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
    const res = await worker.fetch(new Request('https://api.test/nope'), env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
