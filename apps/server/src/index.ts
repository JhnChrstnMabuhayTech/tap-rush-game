import { RULES_VERSION } from '@glowcatch/shared';
import type { Env } from './env';
import { fail, json } from './http';
import { getLeaderboard } from './leaderboard';
import { startRound } from './rounds';
import { submitScore } from './score';

export type { Env } from './env';

/** /v1/rounds/{roundId}/score, where roundId is a UUID. */
const SCORE_PATH =
  /^\/v1\/rounds\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/score$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({ ok: true, rulesVersion: RULES_VERSION });
  }

  if (request.method === 'GET' && url.pathname === '/v1/leaderboard') {
    return getLeaderboard(url, env);
  }
  if (request.method === 'POST' && url.pathname === '/v1/rounds') {
    return startRound(request, env, Date.now());
  }
  const score = request.method === 'POST' ? SCORE_PATH.exec(url.pathname) : null;
  if (score) return submitScore(request, env, score[1]!, Date.now());

  return fail(404, 'not_found');
}
