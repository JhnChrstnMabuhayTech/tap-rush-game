// The play screen: one canvas for the field and fireflies, an effects layer for
// popups and banners, and the HUD. It drives a Round from @glowcatch/shared
// (the same code the server replays) and only ever draws what the round says.

import {
  comboFor,
  Round,
  ROUND_MS,
  type CatchEvent,
  type Combo,
  type Field,
  type Firefly,
  type RoundEvent,
  type Tap,
} from '@glowcatch/shared';
import { kit } from '../ui/kit';
import { phaseBanner, popupsFor, type Popup } from './feedback';
import { measureField, toLogical, viewOf, type View } from './field';
import { createStepper } from './stepper';

/** After the clock hits zero, live fireflies fade out for this long before game over. */
const END_FADE_MS = 900;
const BURST_MS = 320; // token dur-burst
const POPUP_LIFT = 34;
const DPR_MAX = 2;

export interface RoundResult {
  seed: number;
  field: Field;
  score: number;
  caught: number;
  topCombo: Combo;
  taps: readonly Tap[];
}

export interface Play {
  readonly frame: HTMLDivElement;
  /** Starts or resumes the clock. Taps count only while it runs. */
  run(): void;
  /** Stops the clock; the field stays drawn, still. */
  hold(): void;
  readonly round: Round;
  destroy(): void;
}

interface Burst {
  firefly: Readonly<Firefly>;
  at: number;
}

export function createPlay(
  container: HTMLElement,
  options: { seed: number; onPause(): void; onEnd(result: RoundResult): void },
): Play {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const fx = document.createElement('div');
  fx.className = 'gc-fx';
  fx.setAttribute('aria-hidden', 'true');
  const hud = kit.ScoreHud({ onPause: () => options.onPause() });
  const frame = document.createElement('div');
  frame.className = 'gc-frame';
  frame.append(canvas, fx, hud);
  container.replaceChildren(frame);

  // The field is fixed for the whole round; the view follows the frame's size.
  const field = measureField(frame);
  const round = new Round({ seed: options.seed, field });
  const stepper = createStepper();
  let view: View = viewOf(field, field.width, field.height);
  let ctx = sizeCanvas(canvas, field.width, field.height);
  let width = field.width;
  let height = field.height;

  let running = false;
  let last = 0;
  let endedAt = 0;
  let finished = false;
  let heat = 0;
  let bursts: Burst[] = [];
  let raf = requestAnimationFrame(frameLoop);

  const resize = new ResizeObserver(() => {
    width = frame.clientWidth;
    height = frame.clientHeight;
    if (!width || !height) return;
    ctx = sizeCanvas(canvas, width, height);
    view = viewOf(field, width, height);
  });
  resize.observe(frame);

  // pointerdown, not click: it fires on touch-start, and every finger counts.
  canvas.addEventListener('pointerdown', (event) => {
    if (!running || round.state.ended) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const point = toLogical(view, event.clientX - rect.left, event.clientY - rect.top);
    const caught = round.tap(point.x, point.y);
    if (caught) onCatch(caught, performance.now());
  });

  function frameLoop(now: number) {
    const elapsed = last ? now - last : 0;
    last = now;
    // After the end, steps only age the last fireflies until they've faded out,
    // behind the game-over sheet; nothing is decided any more.
    const fading = round.state.ended && round.state.fireflies.length > 0;
    if (running || (finished && fading)) {
      for (let ticks = stepper.advance(elapsed); ticks > 0; ticks--) onEvents(round.step(), now);
    }
    if (endedAt && !finished && now - endedAt >= END_FADE_MS) finish();
    draw(now, elapsed);
    raf = requestAnimationFrame(frameLoop);
  }

  function onEvents(events: RoundEvent[], now: number) {
    for (const event of events) {
      if (event.type === 'phase') kit.PhaseBanner({ parent: fx, ...phaseBanner(event.phaseIndex) });
      else if (event.type === 'end') endedAt = now;
    }
  }

  function onCatch(event: CatchEvent, now: number) {
    bursts.push({ firefly: event.firefly, at: now });
    for (const popup of popupsFor(event)) showPopup(popup, event.firefly);
    navigator.vibrate?.(8);
  }

  function showPopup(popup: Popup, firefly: Readonly<Firefly>) {
    const x = popup.at === 'banner' ? width / 2 : firefly.x * view.sx;
    const y =
      popup.at === 'banner'
        ? height * 0.3
        : firefly.y * view.sy - (popup.at === 'above' ? POPUP_LIFT : 0);
    kit.FloatText({
      parent: fx,
      text: popup.text,
      tone: popup.tone,
      big: popup.big,
      icon: popup.icon,
      x,
      y,
    });
  }

  function draw(now: number, elapsed: number) {
    const s = round.state;
    const frozen = s.frozenMs > 0 && !s.ended;
    // The sky warms with the streak: quickly as it grows, slowly as it cools.
    const target = s.streak ? Math.min(1, s.streak / 12) : 0;
    heat += (target - heat) * Math.min(1, elapsed / (target > heat ? 180 : 700));

    kit.drawField(ctx, width, height, {
      time: frozen ? 0 : now,
      seed: 11,
      phase: s.phaseIndex,
      frozen: Math.min(1, s.frozenMs / 300),
      heat,
      hot: comboFor(s.streak) === 3,
    });
    // While frozen, rings, spokes and motes hold still with everything else.
    const clock = frozen ? 0 : now;
    for (const f of s.fireflies) {
      kit.drawFirefly(
        ctx,
        { ...place(f), life: f.life, seed: seedOf(f), kind: drawnKind(f, false) },
        clock,
      );
    }
    bursts = bursts.filter((burst) => now - burst.at < BURST_MS);
    for (const { firefly, at } of bursts) {
      const caught = (now - at) / BURST_MS;
      kit.drawFirefly(
        ctx,
        { ...place(firefly), caught, seed: seedOf(firefly), kind: drawnKind(firefly, true) },
        now,
      );
    }

    hud.update({
      score: s.score,
      timeLeft: Math.max(0, (ROUND_MS - s.elapsedMs) / 1000),
      streak: s.streak,
      streakLeft: s.streak ? s.streakLeftMs / s.difficulty.streakWindow : 0,
      frozen: s.frozenMs,
    });
  }

  function place(f: Readonly<Firefly>) {
    return { x: f.x * view.sx, y: f.y * view.sy, r: f.r * view.scale };
  }

  function finish() {
    finished = true;
    running = false;
    const { score, caught, topCombo } = round.state;
    options.onEnd({ seed: options.seed, field, score, caught, topCombo, taps: round.taps });
  }

  return {
    frame,
    round,
    run() {
      if (finished) return;
      stepper.reset();
      last = 0;
      running = true;
    },
    hold() {
      running = false;
    },
    destroy() {
      cancelAnimationFrame(raf);
      resize.disconnect();
      frame.remove();
    },
  };
}

/** Swarm motes are drawn as small plain fireflies, and burst in Swarm's colour. */
function drawnKind(f: Readonly<Firefly>, caught: boolean) {
  if (f.kind === 'swarm-mote') return caught ? 'swarm' : 'normal';
  return f.kind;
}

/** The kit's flicker and wing-beat phase, in radians. */
function seedOf(f: Readonly<Firefly>) {
  return f.phase * 6.283;
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
