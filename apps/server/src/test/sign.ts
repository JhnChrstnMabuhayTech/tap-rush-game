// Signed player info as FBInstant.player.getSignedPlayerInfoAsync() makes it,
// signed with the tests' App Secret (vitest.config.ts).
import { env } from 'cloudflare:workers';

export interface PlayerInfo {
  algorithm: string;
  issued_at: number;
  player_id: string;
  request_payload: string | null;
}

/** Player info issued at `now`, as Facebook would send it. */
export function playerInfo(
  playerId: string,
  requestPayload: string | null = null,
  now = Date.now(),
): PlayerInfo {
  return {
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(now / 1000),
    player_id: playerId,
    request_payload: requestPayload,
  };
}

export async function signPlayerInfo(info: object, secret = env.APP_SECRET): Promise<string> {
  const encoded = encodePlayerInfo(info);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  return `${toBase64Url(new Uint8Array(signature))}.${encoded}`;
}

export function encodePlayerInfo(info: object): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(info)));
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
