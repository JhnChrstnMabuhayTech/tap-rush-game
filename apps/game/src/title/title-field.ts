// The title screen's living sky. Fireflies drift above the name and can be
// caught: each catch bursts and chimes a step higher, and a few in a row warm
// the horizon, as a combo does in a round. Now and then a bonus firefly
// visits; catching it names it. The home screen teaches the game by letting
// you touch it before you press Play. Nothing here is scored.

import type { BonusKind, CatchEvent, FireflyKind } from '@glowcatch/shared';
import type { Sound } from '../audio/sound';
import { kit } from '../ui/kit';
import { hitTitleFirefly, nextVisitor, spawnArea, VISITOR_COPY } from './title-logic';

const MAX_ALIVE = 5;
const OPENING_COUNT = 3;
const SPAWN_EVERY_MS = [700, 1400] as const;
const LIFE_MS = [3200, 5200] as const;
const FIRST_VISIT_MS = 2500;
const VISITOR_EVERY_MS = [6000, 9000] as const;
const VISITOR_LIFE_MS = 4200;
const MOTE_LIFE_MS = 1600;
/** The title's streak cools after this long without a catch. */
const STREAK_WINDOW_MS = 3000;
const FREEZE_MS = 1500;
const BURST_MS = 320;
const HINT_AFTER_MS = 3500;
const LABEL_MS = 2800;
/** After this many catches, Play invites more eagerly. */
const EAGER_AFTER = 3;

interface Firefly {
  kind: FireflyKind;
  /** Home, as a share of the frame, so a resize keeps it in place. */
  fx: number;
  fy: number;
  x: number;
  y: number;
  r: number;
  ageMs: number;
  lifeMs: number;
  life: number;
  /** Swarm motes appear one after another. */
  delayMs: number;
  seed: number;
  wander: number;
  mote: boolean;
}

export interface TitleField {
  readonly frame: HTMLDivElement;
  /** For browser checks: what's catchable right now, in frame pixels. */
  readonly fireflies: readonly { x: number; y: number; kind: FireflyKind }[];
  stop(): void;
}

export function createTitleField(
  container: HTMLElement,
  options: { sound: Pick<Sound, 'catch'>; onEager(): void },
): TitleField {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const fx = document.createElement('div');
  fx.className = 'gc-fx';
  fx.setAttribute('aria-hidden', 'true');
  const frame = document.createElement('div');
  frame.className = 'gc-frame';
  frame.append(canvas, fx);
  container.replaceChildren(frame);

  let width = 0;
  let height = 0;
  let insetTop = 0; // the safe-area inset, measured on resize rather than every frame
  let ctx: CanvasRenderingContext2D | null = null;
  let fireflies: Firefly[] = [];
  let bursts: { f: Firefly; at: number }[] = [];
  let lastVisitor: BonusKind | null = null;
  let clock = 0; // ms the title has been running, frozen time excluded
  let nextSpawn = 0;
  let nextVisit = FIRST_VISIT_MS;
  let streak = 0;
  let lastCatch = -Infinity;
  let caught = 0;
  let heat = 0;
  let frozenMs = 0;
  let last = 0;
  let shownMs = 0;
  let hinted = false;
  let raf = requestAnimationFrame(loop);

  const resize = new ResizeObserver(() => {
    width = frame.clientWidth;
    height = frame.clientHeight;
    if (width && height) ctx = sizeCanvas(canvas, width, height);
    insetTop = safeTop(frame);
  });
  resize.observe(frame);

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const visible = fireflies.filter((f) => f.delayMs <= 0);
    const target = hitTitleFirefly(visible, event.clientX - rect.left, event.clientY - rect.top);
    if (target) catchFirefly(target);
  });

  function loop(now: number) {
    const elapsed = last ? Math.min(50, now - last) : 0;
    last = now;
    if (ctx && width && height) {
      shownMs += elapsed;
      const frozen = frozenMs > 0;
      if (frozen) frozenMs = Math.max(0, frozenMs - elapsed);
      else clock += elapsed;
      age(elapsed, frozen);
      spawn();
      hint();
      if (streak && shownMs - lastCatch > STREAK_WINDOW_MS) streak = 0;
      draw(ctx, now, elapsed, frozen);
    }
    raf = requestAnimationFrame(loop);
  }

  function spawn() {
    if (frozenMs > 0) return;
    const normals = fireflies.filter((f) => f.kind === 'normal' && !f.mote).length;
    // Arrive with a few already glowing, so the sky is never empty.
    if (fireflies.length === 0 && caught === 0) {
      for (let i = 0; i < OPENING_COUNT; i++) fireflies.push(make('normal', between(LIFE_MS)));
      nextSpawn = clock + between(SPAWN_EVERY_MS);
    } else if (normals < MAX_ALIVE && clock >= nextSpawn) {
      fireflies.push(make('normal', between(LIFE_MS)));
      nextSpawn = clock + between(SPAWN_EVERY_MS);
    }
    if (clock >= nextVisit && !fireflies.some((f) => f.kind !== 'normal')) {
      lastVisitor = nextVisitor(lastVisitor);
      fireflies.push(make(lastVisitor, VISITOR_LIFE_MS));
      nextVisit = clock + between(VISITOR_EVERY_MS);
    }
  }

  function make(kind: FireflyKind, lifeMs: number, near?: Firefly, delayMs = 0): Firefly {
    const start = parseFloat(kit.token('firefly-start')) || 72;
    const scale = Math.min(1.25, Math.min(width, height) / 390);
    const r = (start / 2) * scale * (near ? 0.45 : kind === 'lantern' ? 0.95 : 0.7);
    const area = currentArea(r);
    const x = near
      ? clamp(near.x + (Math.random() - 0.5) * 160, area.left, area.right)
      : between([area.left, area.right]);
    const y = near
      ? clamp(near.y + (Math.random() - 0.5) * 120, area.top, area.bottom)
      : between([area.top, area.bottom]);
    return {
      kind,
      fx: x / width,
      fy: y / height,
      x,
      y,
      r,
      ageMs: 0,
      lifeMs,
      life: 1,
      delayMs,
      seed: Math.random() * 6.283,
      wander: kind === 'normal' ? 10 : 16,
      mote: !!near,
    };
  }

  function currentArea(r: number) {
    const name = frame.querySelector('.gc-title-name');
    const frameTop = frame.getBoundingClientRect().top;
    const nameTop = name ? name.getBoundingClientRect().top - frameTop : height * 0.55;
    return spawnArea(width, height, nameTop, r, insetTop);
  }

  function age(elapsed: number, frozen: boolean) {
    const alive: Firefly[] = [];
    for (const f of fireflies) {
      if (f.delayMs > 0) {
        f.delayMs -= elapsed;
        alive.push(f);
        continue;
      }
      if (!frozen) f.ageMs += elapsed;
      f.life = 1 - f.ageMs / f.lifeMs;
      if (f.life <= 0) continue;
      const t = clock / 1000 + f.seed;
      f.x = f.fx * width + Math.sin(t * 0.9) * f.wander;
      f.y = f.fy * height + Math.cos(t * 0.7) * f.wander * 0.8;
      alive.push(f);
    }
    fireflies = alive;
  }

  function catchFirefly(f: Firefly) {
    fireflies = fireflies.filter((g) => g !== f);
    bursts.push({ f, at: performance.now() });
    streak = shownMs - lastCatch <= STREAK_WINDOW_MS ? streak + 1 : 1;
    lastCatch = shownMs;
    caught += 1;
    // The same chime as a round: it climbs with the streak.
    options.sound.catch({
      type: 'catch',
      firefly: { kind: f.mote ? 'swarm-mote' : f.kind },
      points: 0,
      streak,
      combo: streak >= 10 ? 3 : streak >= 5 ? 2 : 1,
      comboUp: streak === 5 || streak === 10,
    } as CatchEvent);
    navigator.vibrate?.(8);

    if (f.kind !== 'normal') {
      const tone = f.kind === 'frost' ? 'frost' : f.kind === 'swarm' ? 'lime' : 'glow';
      const y = Math.max(f.y - f.r - 24, 96);
      label(VISITOR_COPY[f.kind], tone, width / 2, y);
    }
    if (f.kind === 'frost') frozenMs = FREEZE_MS;
    if (f.kind === 'swarm') {
      for (let i = 0; i < 6; i++) fireflies.push(make('normal', MOTE_LIFE_MS, f, i * 120));
    }
    if (caught === EAGER_AFTER) options.onEager();
  }

  // Once per visit, if nothing has been touched yet: a quiet invitation.
  function hint() {
    if (hinted || caught || shownMs < HINT_AFTER_MS) return;
    const target = fireflies.find((f) => f.kind === 'normal' && f.delayMs <= 0 && f.life > 0.5);
    if (!target) return;
    hinted = true;
    label('Tap a firefly', 'ink', target.x, target.y - target.r - 18);
  }

  function draw(context: CanvasRenderingContext2D, now: number, elapsed: number, frozen: boolean) {
    const target = streak ? Math.min(1, streak / 12) : 0;
    heat += (target - heat) * Math.min(1, elapsed / (target > heat ? 180 : 700));
    // While frozen, the meadow, stars and fireflies hold still.
    const time = frozen ? 0 : now;
    kit.drawField(context, width, height, {
      time,
      seed: 5,
      frozen: Math.min(1, frozenMs / 300),
      heat,
      hot: streak >= 10,
    });
    drawMoon(context, now);
    for (const f of fireflies) {
      if (f.delayMs > 0) continue;
      kit.drawFirefly(
        context,
        { x: f.x, y: f.y, r: f.r, life: f.life, seed: f.seed, kind: f.mote ? 'normal' : f.kind },
        time,
      );
    }
    bursts = bursts.filter((b) => now - b.at < BURST_MS);
    for (const { f, at } of bursts) {
      const kind = f.mote ? 'swarm' : f.kind;
      kit.drawFirefly(
        context,
        { x: f.x, y: f.y, r: f.r, caught: (now - at) / BURST_MS, seed: f.seed, kind },
        now,
      );
    }
  }

  // Longer-lived than the kit's catch popups: these are sentences to read.
  function label(text: string, tone: 'ink' | 'glow' | 'lime' | 'frost', x: number, y: number) {
    const element = document.createElement('span');
    element.className = `gc-float gc-float-${tone} gc-hint`;
    element.textContent = text;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    fx.append(element);
    window.setTimeout(() => element.remove(), LABEL_MS);
  }

  // The moon, opposite the Sound toggle and above where fireflies appear:
  // "thirty seconds of dusk".
  function drawMoon(context: CanvasRenderingContext2D, now: number) {
    const r = Math.min(width, height) * 0.04;
    const x = Math.max(width * 0.14, r * 2.5);
    const y = insetTop + 44 + Math.sin(now / 9000) * 3;
    const halo = context.createRadialGradient(x, y, r * 0.6, x, y, r * 4);
    halo.addColorStop(0, 'rgba(233, 239, 230, 0.16)'); // token moon, faint
    halo.addColorStop(1, 'rgba(233, 239, 230, 0)');
    context.fillStyle = halo;
    context.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    context.fillStyle = kit.token('moon');
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  return {
    frame,
    get fireflies() {
      return fireflies.filter((f) => f.delayMs <= 0).map(({ x, y, kind }) => ({ x, y, kind }));
    },
    stop() {
      cancelAnimationFrame(raf);
      resize.disconnect();
    },
  };
}

function between([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeTop(frame: HTMLElement): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top, 0px)';
  frame.append(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return inset;
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
