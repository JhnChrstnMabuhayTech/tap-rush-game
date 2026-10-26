// The screen flow from docs/design/states.md: title → countdown → play ⇄ paused
// → game over → countdown again, or back to the title. One screen at a time.

import { createSound, type Sound } from './audio/sound';
import type { Platform } from './platform/platform';
import { createPlay, type Play, type RoundResult } from './round/play';
import { createBestStore, type BestRecord } from './storage/best';
import { createTitleField, type TitleField } from './title/title-field';
import { kit } from './ui/kit';

type Screen = 'title' | 'countdown' | 'playing' | 'paused' | 'over';

const shareText = (score: number) =>
  `I scored ${score} in 30 seconds of Glowcatch. Can you beat it?`;

export function startApp(root: HTMLElement, platform: Platform) {
  const best = createBestStore();
  const sound = createSound();
  let screen: Screen = 'title';
  let title: TitleField | null = null;
  let play: Play | null = null;
  let countdownTimer = 0;

  // Pause whenever the player looks away: Facebook's own pause, or a hidden tab.
  platform.onPause(pause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('keydown', onKey);
  // Audio may only start inside a gesture; iOS counts touchend and click, not touchstart.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, () => sound.unlock(), { capture: true, passive: true });
  }
  if (import.meta.env.DEV) {
    Object.assign(window, { glowcatch: { current: () => play, title: () => title, sound } });
  }

  showTitle();

  function showTitle() {
    clear();
    screen = 'title';
    const menu = kit.TitleScreen({ best: best.get(), onPlay: startRound });
    // Taps pass through the title to the fireflies behind it, except on its controls.
    menu.classList.add('screen', 'is-passthrough');
    const toggle = soundToggle(sound, true);
    toggle.classList.add('gc-corner');
    menu.append(toggle);
    title = createTitleField(root, { sound, onEager: () => menu.classList.add('is-eager') });
    title.frame.append(menu);
  }

  function startRound() {
    clear();
    play = createPlay(root, { seed: randomSeed(), sound, onPause: pause, onEnd: showGameOver });
    countdown(play);
  }

  // 3, 2, 1, then the clock starts on "Go!". The first firefly is nearly a
  // second away, so "Go!" fades out before there's anything to catch.
  function countdown(current: Play) {
    screen = 'countdown';
    const stepMs = parseFloat(kit.token('dur-count')) || 800;
    const steps = [3, 2, 1, 0] as const;
    let step = 0;
    const next = () => {
      current.frame.querySelector('.gc-countdown')?.remove();
      if (step === steps.length) return;
      const value = steps[step++]!;
      const element = kit.Countdown({ value, hint: value === 3 ? 'Get ready' : undefined });
      current.frame.append(element);
      sound.countdown(value);
      if (value === 0) {
        element.style.pointerEvents = 'none';
        screen = 'playing';
        current.run();
        sound.ambience(true);
        navigator.vibrate?.(12);
      }
      countdownTimer = window.setTimeout(next, stepMs);
    };
    next();
  }

  function pause() {
    if (!play || (screen !== 'playing' && screen !== 'countdown')) return;
    if (play.round.state.ended) return; // the last fireflies are fading; game over is coming
    window.clearTimeout(countdownTimer);
    play.frame.querySelector('.gc-countdown')?.remove();
    play.hold();
    sound.ambience(false);
    screen = 'paused';

    const panel = document.createElement('div');
    panel.className = 'gc-panel gc-pause';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Paused');
    const heading = document.createElement('h2');
    heading.textContent = 'Paused';
    const resumeButton = kit.Button({
      label: 'Resume',
      icon: 'play',
      block: true,
      onClick: resume,
    });
    const quit = kit.Button({
      label: 'Quit round',
      variant: 'ghost',
      block: true,
      onClick: showTitle,
    });
    panel.append(heading, resumeButton, soundToggle(sound, false), quit);
    setLayer(play, panel);
    resumeButton.focus();
  }

  // Resuming goes through a fresh 3-2-1, so nobody loses a firefly to a surprise.
  function resume() {
    if (!play || screen !== 'paused') return;
    setLayer(play, null);
    countdown(play);
  }

  function showGameOver(result: RoundResult) {
    if (!play) return;
    screen = 'over';
    const record = best.record(result.score);
    sound.ambience(false);
    sound.roundEnd(record.isNewBest);
    renderGameOver(play, result, record);
  }

  function renderGameOver(current: Play, result: RoundResult, record: BestRecord) {
    const sheet = kit.GameOver({
      score: result.score,
      // The kit shows "—" for a missing best, so a first round of 0 never reads "Best 0".
      best: (record.best || undefined) as number,
      isNewBest: record.isNewBest,
      topCombo: result.topCombo,
      caught: result.caught,
      onShare: () => share(current, result.score, sheet),
      onPlayAgain: startRound,
    });
    setLayer(current, sheet);
  }

  async function share(current: Play, score: number, sheet: HTMLElement) {
    const button = sheet.querySelector<HTMLButtonElement>('.gc-over-actions .gc-btn-secondary');
    setBusy(button, true);
    try {
      // The share card's numerals are in the display face; give it a moment to load.
      await Promise.race([
        document.fonts.load('800 40px "Bricolage Grotesque"').catch(() => undefined),
        delay(1000),
      ]);
      const image = kit.renderShareImage({ score }).toDataURL('image/png');
      await platform.share({ image, text: shareText(score), data: { score } });
    } catch {
      if (play === current && screen === 'over') {
        const notice = kit.Notice({ tone: 'info', message: "Couldn't open sharing." });
        sheet.querySelector('.gc-over-actions')?.before(notice);
        window.setTimeout(() => notice.remove(), 3000);
      }
    } finally {
      setBusy(button, false);
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (screen === 'paused') resume();
      else pause();
      return;
    }
    // Space or Enter starts and restarts, unless a button has focus and handles it.
    const onButton = event.target instanceof HTMLButtonElement;
    if ((event.key === 'Enter' || event.key === ' ') && !onButton) {
      if (screen === 'title' || screen === 'over') {
        event.preventDefault();
        startRound();
      }
    }
  }

  function clear() {
    window.clearTimeout(countdownTimer);
    sound.ambience(false);
    title?.stop();
    title = null;
    play?.destroy();
    play = null;
  }
}

/**
 * The Sound toggle: an icon button on the title, a labelled one when paused.
 * It swaps itself for a fresh button showing the new state.
 */
function soundToggle(sound: Sound, iconOnly: boolean): HTMLButtonElement {
  const button = kit.Button({
    label: 'Sound',
    iconOnly,
    variant: 'ghost',
    block: !iconOnly,
    icon: sound.enabled ? 'sound-on' : 'sound-off',
    pressed: sound.enabled,
    onClick: () => {
      sound.setEnabled(!sound.enabled);
      const next = soundToggle(sound, iconOnly);
      next.className = button.className;
      button.replaceWith(next);
      next.focus();
    },
  });
  return button;
}

/** Shows `content` over the dimmed field, or clears the layer with null. */
function setLayer(current: Play, content: HTMLElement | null) {
  current.frame.querySelector('.gc-layer')?.remove();
  if (!content) return;
  const layer = document.createElement('div');
  layer.className = 'gc-layer';
  layer.append(content);
  current.frame.append(layer);
}

/** The kit's busy state for a button it already rendered: spinner, disabled. */
function setBusy(button: HTMLButtonElement | null, busy: boolean) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('gc-btn-busy', busy);
  button.setAttribute('aria-busy', String(busy));
}

/** Until the server issues seeds (roadmap Phase 3), each round gets a local one. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
