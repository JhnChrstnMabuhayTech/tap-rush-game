import { RULES_VERSION } from '@glowcatch/shared';
import type { Env } from './env';
import { fail, json } from './http';
import { startRound } from './rounds';

export type { Env } from './env';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, rulesVersion: RULES_VERSION });
    }
    if (request.method === 'POST' && url.pathname === '/v1/rounds') {
      return startRound(request, env, Date.now());
    }

    return fail(404, 'not_found');
  },
} satisfies ExportedHandler<Env>;
