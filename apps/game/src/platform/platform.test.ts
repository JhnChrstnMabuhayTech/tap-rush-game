import { describe, expect, it } from 'vitest';
import { choosePlatform } from './platform';

describe('choosePlatform', () => {
  it('uses Facebook when the SDK loaded and the game is in an iframe', () => {
    expect(choosePlatform({ hasSdk: true, embedded: true, forced: null })).toBe('facebook');
  });

  it('runs locally in a top-level tab, even though the SDK script loaded', () => {
    expect(choosePlatform({ hasSdk: true, embedded: false, forced: null })).toBe('local');
  });

  it('runs locally when the SDK failed to load', () => {
    expect(choosePlatform({ hasSdk: false, embedded: true, forced: null })).toBe('local');
    expect(choosePlatform({ hasSdk: false, embedded: false, forced: 'facebook' })).toBe('local');
  });

  it('follows ?platform= when it can', () => {
    expect(choosePlatform({ hasSdk: true, embedded: false, forced: 'facebook' })).toBe('facebook');
    expect(choosePlatform({ hasSdk: true, embedded: true, forced: 'local' })).toBe('local');
  });
});
