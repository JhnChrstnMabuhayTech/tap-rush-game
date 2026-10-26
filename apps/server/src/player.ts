// Who is playing: Facebook's signed player info, checked with the App Secret
// (docs/backend/trust-model.md). `FBInstant.player.getSignedPlayerInfoAsync()`
// returns "<signature>.<payload>", both base64url. The payload is JSON
// ({ algorithm, issued_at, player_id, request_payload }) and the signature is
// the HMAC-SHA256 of the encoded payload, keyed with the App Secret.

import type { Env } from './env';

/** How old a signature may be. The game asks for a fresh one for each request. */
export const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
/** How far ahead of the server's clock a signature's `issued_at` may be. */
const CLOCK_SKEW_MS = 60_000;
/** Facebook's player IDs are digits; local development uses words. */
const PLAYER_ID = /^[\w-]{1,64}$/;
/** The signature part of an unsigned request, for local development only. */
export const UNSIGNED = 'unsigned';

export interface Player {
  id: string;
  /** What the game passed to `getSignedPlayerInfoAsync`, if anything. */
  requestPayload: string | null;
}

export type PlayerCheck =
  | { ok: true; player: Player }
  | { ok: false; reason: 'malformed' | 'signature' | 'algorithm' | 'stale' };

interface Options {
  secret: string;
  /** Accept `unsigned.<payload>` in place of a signature. */
  allowUnsigned?: boolean;
}

export async function verifySignedPlayerInfo(
  signed: string,
  { secret, allowUnsigned = false }: Options,
  now: number,
): Promise<PlayerCheck> {
  const dot = signed.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const signature = signed.slice(0, dot);
  const encoded = signed.slice(dot + 1);
  const payload = parsePayload(encoded);
  if (!payload) return { ok: false, reason: 'malformed' };

  if (signature === UNSIGNED) {
    if (!allowUnsigned) return { ok: false, reason: 'signature' };
  } else if (!(await hmacMatches(signature, encoded, secret))) {
    return { ok: false, reason: 'signature' };
  }

  if (payload.algorithm.toUpperCase() !== 'HMAC-SHA256') return { ok: false, reason: 'algorithm' };
  const issuedAt = payload.issued_at * 1000;
  if (now - issuedAt > SIGNATURE_MAX_AGE_MS || issuedAt - now > CLOCK_SKEW_MS) {
    return { ok: false, reason: 'stale' };
  }
  return { ok: true, player: { id: payload.player_id, requestPayload: payload.request_payload } };
}

/** The player behind a request: signed by Facebook, or unsigned in local development. */
export function identify(signed: string, env: Env, url: URL, now: number): Promise<PlayerCheck> {
  return verifySignedPlayerInfo(
    signed,
    { secret: env.APP_SECRET, allowUnsigned: allowsUnsigned(env, url) },
    now,
  );
}

/**
 * Unsigned requests need the development flag and a request to localhost. A
 * deployed Worker is only reached through its own hostname, so even a flag set
 * by mistake can't open it up.
 */
export function allowsUnsigned(env: Pick<Env, 'ALLOW_UNSIGNED'>, url: URL): boolean {
  return (
    env.ALLOW_UNSIGNED === 'true' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}

interface Payload {
  algorithm: string;
  issued_at: number;
  player_id: string;
  request_payload: string | null;
}

function parsePayload(encoded: string): Payload | undefined {
  const bytes = fromBase64Url(encoded);
  if (!bytes) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const {
    algorithm,
    issued_at,
    player_id,
    request_payload = null,
  } = value as Record<string, unknown>;
  if (
    typeof algorithm !== 'string' ||
    typeof issued_at !== 'number' ||
    !Number.isFinite(issued_at)
  ) {
    return undefined;
  }
  if (typeof player_id !== 'string' || !PLAYER_ID.test(player_id)) return undefined;
  if (request_payload !== null && typeof request_payload !== 'string') return undefined;
  return { algorithm, issued_at, player_id, request_payload };
}

async function hmacMatches(signature: string, encoded: string, secret: string): Promise<boolean> {
  const expected = fromBase64Url(signature);
  if (!expected || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  // verify() recomputes the HMAC and compares in constant time.
  return crypto.subtle.verify('HMAC', key, expected, new TextEncoder().encode(encoded));
}

function fromBase64Url(text: string): Uint8Array | undefined {
  if (!/^[\w-]*={0,2}$/.test(text)) return undefined;
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  try {
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}
