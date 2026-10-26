import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import wrangler from '../wrangler.jsonc?raw';
import { allowsUnsigned, SIGNATURE_MAX_AGE_MS, verifySignedPlayerInfo } from './player';
import { encodePlayerInfo, playerInfo, signPlayerInfo } from './test/sign';

const NOW = Date.UTC(2026, 9, 26, 12);
const options = { secret: env.APP_SECRET };
const info = (overrides: object = {}) => ({ ...playerInfo('1234567890', null, NOW), ...overrides });
const verify = (signed: string, at = NOW, allowUnsigned = false) =>
  verifySignedPlayerInfo(signed, { ...options, allowUnsigned }, at);

describe('verifySignedPlayerInfo', () => {
  it('accepts player info signed with the App Secret', async () => {
    const signed = await signPlayerInfo(info({ request_payload: 'round-1' }));

    expect(await verify(signed)).toEqual({
      ok: true,
      player: { id: '1234567890', requestPayload: 'round-1' },
    });
  });

  it('rejects player info signed with another secret', async () => {
    const signed = await signPlayerInfo(info(), 'not-the-app-secret');

    expect(await verify(signed)).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects player info changed after signing', async () => {
    const [signature] = (await signPlayerInfo(info())).split('.');
    const forged = `${signature}.${encodePlayerInfo(info({ player_id: '999' }))}`;

    expect(await verify(forged)).toEqual({ ok: false, reason: 'signature' });
  });

  it('accepts a signature up to five minutes old, and refuses older or future ones', async () => {
    const signed = await signPlayerInfo(info());

    expect((await verify(signed, NOW + SIGNATURE_MAX_AGE_MS)).ok).toBe(true);
    expect(await verify(signed, NOW + SIGNATURE_MAX_AGE_MS + 1000)).toEqual({
      ok: false,
      reason: 'stale',
    });
    expect(await verify(signed, NOW - 2 * 60_000)).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects any algorithm but HMAC-SHA256', async () => {
    const signed = await signPlayerInfo(info({ algorithm: 'HMAC-SHA1' }));

    expect(await verify(signed)).toEqual({ ok: false, reason: 'algorithm' });
  });

  it("rejects anything that isn't signed player info", async () => {
    const signature = (await signPlayerInfo(info())).split('.')[0]!;
    const malformed = [
      '',
      'no-dot',
      `.${encodePlayerInfo(info())}`,
      `${signature}.`,
      `${signature}.not base64!`,
      `${signature}.${btoa('not json')}`,
      `${signature}.${encodePlayerInfo({ ...info(), player_id: undefined })}`,
      `${signature}.${encodePlayerInfo(info({ player_id: 'has spaces' }))}`,
      `${signature}.${encodePlayerInfo(info({ issued_at: 'yesterday' }))}`,
      `${signature}.${encodePlayerInfo(info({ request_payload: 42 }))}`,
    ];

    for (const signed of malformed) {
      expect(await verify(signed), signed).toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('accepts unsigned player info only when allowed', async () => {
    const unsigned = `unsigned.${encodePlayerInfo(info())}`;

    expect(await verify(unsigned)).toEqual({ ok: false, reason: 'signature' });
    expect((await verify(unsigned, NOW, true)).ok).toBe(true);
  });
});

describe('unsigned requests', () => {
  it('need the development flag and a request to localhost', () => {
    const on = { ALLOW_UNSIGNED: 'true' };

    expect(allowsUnsigned(on, new URL('http://localhost:8787/v1/rounds'))).toBe(true);
    expect(allowsUnsigned(on, new URL('http://127.0.0.1:8787/v1/rounds'))).toBe(true);
    expect(allowsUnsigned(on, new URL('https://glowcatch-api.example.workers.dev/v1/rounds'))).toBe(
      false,
    );
    expect(allowsUnsigned({}, new URL('http://localhost:8787/v1/rounds'))).toBe(false);
    expect(
      allowsUnsigned({ ALLOW_UNSIGNED: '1' }, new URL('http://localhost:8787/v1/rounds')),
    ).toBe(false);
  });

  it("can't be switched on in wrangler.jsonc, which deploys", () => {
    expect(wrangler).not.toMatch(/"ALLOW_UNSIGNED"\s*:/);
  });
});
