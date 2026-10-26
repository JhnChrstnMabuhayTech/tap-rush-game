// A player for tests: plays a whole round through the shared simulation, the
// way the game would, so the server has a real tap log to replay.
import { Round, TICK_MS, type RoundConfig, type Tap } from '@glowcatch/shared';

export interface Played {
  taps: Tap[];
  score: number;
  /** Ticks the round took. */
  ticks: number;
}

/**
 * Taps the firefly closest to fading once it has been on screen for
 * `reactionMs`, with at least `gapMs` between taps.
 */
export function playRound(config: RoundConfig, { reactionMs = 400, gapMs = 150 } = {}): Played {
  const round = new Round(config);
  const appeared = new Map<number, number>();
  let lastTap = -Infinity;
  while (!round.state.ended) {
    const tick = round.state.tick;
    if ((tick - lastTap) * TICK_MS >= gapMs) {
      const target = round.state.fireflies
        .filter((f) => (tick - appeared.get(f.id)!) * TICK_MS >= reactionMs)
        .sort((a, b) => a.life - b.life)[0];
      if (target) {
        round.tap(target.x, target.y);
        lastTap = tick;
      }
    }
    for (const event of round.step()) {
      if (event.type === 'spawn') appeared.set(event.firefly.id, round.state.tick);
    }
  }
  return { taps: [...round.taps], score: round.state.score, ticks: round.state.tick };
}
