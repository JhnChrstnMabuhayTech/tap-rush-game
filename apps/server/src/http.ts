import type { ApiError, ApiErrorCode } from '@glowcatch/shared';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function fail(
  status: number,
  error: ApiErrorCode,
  headers: Record<string, string> = {},
): Response {
  return json({ error } satisfies ApiError, status, headers);
}

/**
 * Any page may call the API. It trusts Facebook's signature on each request,
 * not the page it came from, and uses no cookies, so limiting origins would
 * protect nothing (D17).
 */
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

/** The response, with the CORS headers every answer carries. */
export function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.headers.set(name, value);
  return response;
}

/** The request body parsed as JSON, or undefined if it isn't JSON or is over `maxBytes`. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return undefined;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
