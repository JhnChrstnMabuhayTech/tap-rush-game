import { PHASES, type CatchEvent, type PhaseIndex } from '@glowcatch/shared';

// What the player sees for each moment of the round, as data. Copy and tones
// come from the design: docs/design/gameplay.md and the copy deck in states.md.

export interface Popup {
  text: string;
  tone: 'ink' | 'lime' | 'glow' | 'frost';
  big?: boolean;
  icon?: 'frost' | 'spark';
  /** At the catch point, just above it, or high on the field where it covers nothing. */
  at: 'catch' | 'above' | 'banner';
}

/** One popup per catch, plus one for a bonus effect and one when the multiplier goes up. */
export function popupsFor(event: CatchEvent): Popup[] {
  const { firefly, points, combo, comboUp } = event;
  const popups: Popup[] =
    firefly.kind === 'lantern'
      ? [{ text: `+${points}`, tone: 'glow', big: true, at: 'catch' }]
      : [
          {
            text: `+${points}`,
            tone: combo === 3 ? 'glow' : combo === 2 ? 'lime' : 'ink',
            at: 'catch',
          },
        ];

  if (firefly.kind === 'frost') {
    popups.push({ text: 'Frozen 3s', tone: 'frost', big: true, icon: 'frost', at: 'banner' });
  } else if (firefly.kind === 'swarm') {
    popups.push({ text: 'Swarm', tone: 'lime', icon: 'spark', at: 'above' });
  }
  if (comboUp) {
    popups.push({
      text: `×${combo} combo`,
      tone: combo === 3 ? 'glow' : 'lime',
      icon: 'spark',
      at: 'above',
    });
  }
  return popups;
}

/** The banner for entering a phase: "Night falls", then "Midnight". */
export function phaseBanner(index: PhaseIndex) {
  return {
    step: `Phase ${index + 1} of 3`,
    name: PHASES[index].name,
    hint: index === 1 ? 'Faster and smaller' : 'Last stretch',
  };
}
