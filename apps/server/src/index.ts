import { RULES_VERSION } from '@glowcatch/shared';
import type { Env } from './env';

export type { Env } from './env';

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, rulesVersion: RULES_VERSION });
    }

    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<Env>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
