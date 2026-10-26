// How to play, in one sheet: the goal, the four fireflies and what each one
// does, the combo, and the pace. It's built around the design system's
// BonusLegend (the fireflies drawn live, their effects, and the combo rule,
// in the copy deck's words), with a few lines the legend leaves out.

import { kit } from '../ui/kit';

const LEAD = 'Thirty seconds of dusk. Tap each firefly before its light fades.';
const TIPS = [
  'The bar under your score drains between catches. Catch again before it empties to keep your combo.',
  'Bonuses never break a combo, even when they fade.',
  'The more you catch, the faster night falls: fireflies come quicker and smaller.',
];

/** The sheet. "Got it" and Escape both call `onDone`. */
export function howToPlaySheet(onDone: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'gc-panel gc-howto';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'How to play');

  const heading = document.createElement('h2');
  heading.textContent = 'How to play';
  const lead = document.createElement('p');
  lead.className = 'gc-howto-lead';
  lead.textContent = LEAD;
  const tips = document.createElement('ul');
  tips.className = 'gc-howto-tips';
  for (const tip of TIPS) {
    const item = document.createElement('li');
    item.textContent = tip;
    tips.append(item);
  }
  const done = kit.Button({ label: 'Got it', block: true, onClick: onDone });

  panel.append(heading, lead, kit.BonusLegend({ title: null }), tips, done);
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') onDone();
  });
  window.setTimeout(() => done.focus());
  return panel;
}

/** The title's "How to play" button, with a "?" drawn in the kit's icon style. */
export function howToPlayButton(onOpen: () => void): HTMLButtonElement {
  const button = kit.Button({
    label: 'How to play',
    variant: 'ghost',
    block: true,
    onClick: onOpen,
  });
  button.prepend(helpIcon());
  return button;
}

// The kit has no help icon: a "?" in a circle, 24×24 with a 2.25 stroke and
// round caps, like the other thirteen.
function helpIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.25',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  })) {
    svg.setAttribute(name, value);
  }
  svg.innerHTML =
    '<circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.2-2.4 3.7"/><path d="M12 17.4v.1"/>';
  return svg;
}
