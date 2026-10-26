// How badges look: each one is a firefly on a medallion, lit once earned and
// dark until then, so the light stays the UI. Built from the kit's drawing,
// tokens and buttons; the layout lives in styles.css (gc-badge*).

import { kit } from '../ui/kit';
import { BADGES, earnedBadges, nextBadge, progressToNext, type Badge } from './badges';

/** A badge's medallion, drawn on its own canvas at `size` CSS pixels. */
export function medallion(badge: Badge, earned: boolean, size = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const middle = size / 2;
  const radius = size / 2 - 2;
  ctx.fillStyle = kit.token('sky-deep');
  ctx.beginPath();
  ctx.arc(middle, middle, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = kit.token(earned ? 'line-strong' : 'line');
  ctx.stroke();

  // One dot per tier along the top of the rim, like the mark's trail of light.
  const tier = BADGES.indexOf(badge) + 1;
  ctx.fillStyle = kit.token(earned ? 'ink' : 'line');
  for (let i = 0; i < tier; i++) {
    const angle = -Math.PI / 2 + (i - (tier - 1) / 2) * 0.32;
    ctx.beginPath();
    ctx.arc(
      middle + Math.cos(angle) * (radius - 6),
      middle + Math.sin(angle) * (radius - 6),
      1.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // The firefly's halo stays inside the medallion rather than squaring off at
  // the canvas edge. An unearned badge is a firefly whose light is nearly out.
  ctx.save();
  ctx.beginPath();
  ctx.arc(middle, middle, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  kit.drawFirefly(
    ctx,
    {
      x: middle,
      y: middle + 3,
      r: size * 0.24,
      life: earned ? 1 : 0.18,
      seed: tier,
      kind: badge.kind,
    },
    0,
  );
  if (!earned) {
    // drawFirefly sets its own alpha, so dim a locked one with a veil of night.
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = kit.token('sky-deep');
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();
  return canvas;
}

/** The title's entry point: "Badges 3/7". */
export function badgesButton(best: number, onOpen: () => void): HTMLButtonElement {
  return kit.Button({
    label: `Badges ${earnedBadges(best).length}/${BADGES.length}`,
    variant: 'ghost',
    icon: 'spark',
    block: true,
    onClick: onOpen,
  });
}

/** The collection: every badge, earned or not, with the next one marked. */
export function badgesSheet(best: number, onClose: () => void): HTMLElement {
  const earned = earnedBadges(best).length;
  const next = nextBadge(best);
  const panel = element('div', 'gc-panel gc-badges');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Badges');

  const heading = element('div', 'gc-badges-head');
  const titles = element('div');
  titles.append(
    element('h2', '', 'Badges'),
    element('p', '', `${earned} of ${BADGES.length} earned`),
  );
  const close = kit.Button({ label: 'Close', iconOnly: true, icon: 'close', onClick: onClose });
  heading.append(titles, close);

  const grid = element('ul', 'gc-badges-grid');
  for (const badge of BADGES) {
    const isEarned = badge.score <= best;
    const card = element(
      'li',
      `gc-badge${isEarned ? '' : ' is-locked'}${badge === next ? ' is-next' : ''}`,
    );
    card.append(
      medallion(badge, isEarned),
      element('b', '', badge.name),
      element('span', 'gc-num', isEarned ? `Score ${badge.score}` : `Reach ${badge.score}`),
    );
    grid.append(card);
  }
  panel.append(heading, grid);
  if (next) panel.append(nextLine(best));
  window.setTimeout(() => close.focus());
  return panel;
}

/** On game over, when a round earned badges: the best of them, with a pop. */
export function unlockCard(unlocked: readonly Badge[]): HTMLElement {
  const top = unlocked.at(-1)!;
  const card = element('div', 'gc-unlock');
  card.setAttribute('role', 'status');
  const text = element('div');
  const more = unlocked.length > 1 ? `, and ${unlocked.length - 1} more` : '';
  text.append(
    element('span', 'gc-label', 'New badge'),
    element('b', '', `${top.name}${more}`),
    element('span', 'gc-unlock-detail', `Score ${top.score} in a round`),
  );
  card.append(medallion(top, true, 56), text);
  return card;
}

/** How far the best has come toward the next badge: a line of text and a bar. */
export function nextLine(best: number): HTMLElement {
  const next = nextBadge(best)!;
  const line = element('div', 'gc-next');
  const text = element('p');
  text.append('Next badge: ', element('b', '', next.name), ` at ${next.score}`);
  const togo = element('span', 'gc-num', `${next.score - best} to go`);
  const label = element('div', 'gc-next-label');
  label.append(text, togo);
  const bar = element('span', 'gc-next-bar');
  const fill = element('i');
  fill.style.transform = `scaleX(${progressToNext(best)})`;
  bar.append(fill);
  bar.setAttribute('aria-hidden', 'true');
  line.append(label, bar);
  return line;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
