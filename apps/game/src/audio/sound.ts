// Glowcatch's sound, all synthesised with Web Audio: nothing to download, and
// the chime's pitch can follow the streak exactly (decision D9).
//
// Browsers only allow audio after the player touches the page, so no audio
// node exists until unlock() runs inside a user gesture; until then every
// call is silent. Music and sound effects can each be switched off, and both
// settings are remembered on the device.

import type { CatchEvent } from '@glowcatch/shared';
import { chimeFor, comboUpNotes, countdownPip, GO_CHORD, noteAbove, PAD_NOTES } from './notes';

const MUSIC_KEY = 'glowcatch.music';
const EFFECTS_KEY = 'glowcatch.effects';
/** Before music and effects were separate, one Sound switch muted both. */
const LEGACY_KEY = 'glowcatch.sound';
const AMBIENT_FADE_IN = 1.5;
const AMBIENT_FADE_OUT = 0.6;
/** Overall loudness: peaks near half scale, enough for phone speakers; the compressor guards the rest. */
const MASTER_LEVEL = 1.6;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface Sound {
  /** The ambience under the round, and the title's music. */
  readonly music: boolean;
  /** Chimes, ticks, the countdown and the round's end. */
  readonly effects: boolean;
  /** 'locked' until the first gesture, then the AudioContext's own state. */
  readonly state: AudioContextState | 'locked';
  setMusic(on: boolean): void;
  setEffects(on: boolean): void;
  /** Call from every user gesture: creates or resumes audio when the browser allows it. */
  unlock(): void;
  /** The catch chime: it climbs with the streak; bonuses and new multipliers add to it. */
  catch(event: CatchEvent): void;
  /** One quiet tick for each of the last five seconds. */
  tick(): void;
  /** A soft close to the round, with a sparkle for a new best. */
  roundEnd(isNewBest: boolean): void;
  /** 3, 2, 1: a pip that climbs each step. 0 is "Go!": a bright strum. */
  countdown(step: 3 | 2 | 1 | 0): void;
  /** The night ambience under the round: a low pad and crickets. */
  ambience(on: boolean): void;
}

interface Graph {
  ctx: AudioContext;
  /** Everything effects play into; muted when effects are off. */
  effects: GainNode;
  /** The music bus; muted when music is off. Music sources feed it. */
  music: GainNode;
  /** The round's ambience, faded in and out, into the music bus. */
  ambientBus: GainNode;
}

/**
 * `createContext` is called once, on the first unlock; pass your own to route
 * the output elsewhere (a recorder, a test). It returns null where there's no Web Audio.
 */
export function createSound(
  storage: Store | null = deviceStorage(),
  createContext: () => AudioContext | null = browserContext,
): Sound {
  let musicOn = readSetting(storage, MUSIC_KEY);
  let effectsOn = readSetting(storage, EFFECTS_KEY);
  let graph: Graph | null = null;
  let wantAmbience = false;
  let stopAmbience: (() => void) | null = null;

  const sound: Sound = {
    get music() {
      return musicOn;
    },
    get effects() {
      return effectsOn;
    },
    get state() {
      return graph ? graph.ctx.state : 'locked';
    },

    setMusic(on) {
      musicOn = on;
      writeSetting(storage, MUSIC_KEY, on);
      if (graph) fade(graph.ctx, graph.music, on ? 1 : 0);
    },

    setEffects(on) {
      effectsOn = on;
      writeSetting(storage, EFFECTS_KEY, on);
      if (graph) fade(graph.ctx, graph.effects, on ? 1 : 0);
    },

    unlock() {
      if (!graph) {
        const ctx = createContext();
        if (!ctx) return;
        graph = buildGraph(ctx, musicOn, effectsOn);
      }
      if (graph.ctx.state === 'suspended') void graph.ctx.resume();
      if (wantAmbience && !stopAmbience) stopAmbience = startAmbience(graph);
    },

    catch(event) {
      if (!graph) return;
      const { ctx, effects } = graph;
      const t = ctx.currentTime;
      const note = chimeFor(event.streak);
      const kind = event.firefly.kind;

      if (kind === 'lantern') {
        chime(ctx, effects, note, t, 0.16);
        chime(ctx, effects, note * 1.5, t + 0.07, 0.12);
      } else if (kind === 'frost') {
        chime(ctx, effects, note, t, 0.14);
        // An icy glint that slides down, like frost settling.
        voice(ctx, effects, note * 4, t, {
          type: 'triangle',
          gain: 0.045,
          duration: 0.6,
          glideTo: note * 2,
        });
      } else if (kind === 'swarm') {
        [1, 1.25, 1.5].forEach((ratio, i) => chime(ctx, effects, note * ratio, t + i * 0.05, 0.11));
      } else {
        chime(ctx, effects, note, t, kind === 'swarm-mote' ? 0.1 : 0.15);
      }

      if (event.comboUp) {
        const [octave, fifth] = comboUpNotes(event.streak);
        chime(ctx, effects, octave, t + 0.09, 0.1);
        chime(ctx, effects, fifth, t + 0.18, 0.08);
      }
    },

    tick() {
      if (!graph) return;
      voice(graph.ctx, graph.effects, 1760, graph.ctx.currentTime, {
        type: 'triangle',
        gain: 0.035,
        duration: 0.06,
      });
    },

    roundEnd(isNewBest) {
      if (!graph) return;
      const { ctx, effects } = graph;
      const t = ctx.currentTime;
      // G, D, G: the round settles back to its home note.
      [0, 7, 12].forEach((semitones, i) =>
        chime(ctx, effects, noteAbove(semitones), t + i * 0.14, 0.09, 1.4),
      );
      if (isNewBest) {
        [16, 19, 24, 28].forEach((semitones, i) =>
          chime(ctx, effects, noteAbove(semitones), t + 0.5 + i * 0.07, 0.06, 0.8),
        );
      }
    },

    countdown(step) {
      if (!graph) return;
      const { ctx, effects } = graph;
      const t = ctx.currentTime;
      if (step === 0) {
        GO_CHORD.forEach((note, i) => chime(ctx, effects, note, t + i * 0.035, 0.11, 0.9));
        return;
      }
      // A short, rounded pip with a faint click on top, so it reads on phone speakers.
      const pip = countdownPip(step);
      voice(ctx, effects, pip, t, { type: 'triangle', gain: 0.13, duration: 0.22 });
      voice(ctx, effects, pip * 2, t, { gain: 0.03, duration: 0.08 });
    },

    ambience(on) {
      wantAmbience = on;
      if (!graph) return;
      if (on && !stopAmbience) stopAmbience = startAmbience(graph);
      if (!on && stopAmbience) {
        stopAmbience();
        stopAmbience = null;
      }
    },
  };
  return sound;
}

function browserContext(): AudioContext | null {
  const AudioContextClass =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function buildGraph(ctx: AudioContext, musicOn: boolean, effectsOn: boolean): Graph {
  // master → compressor (rapid catches never clip) → speakers
  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  master.connect(compressor).connect(ctx.destination);

  // A little night air: a short generated reverb shared by everything.
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.2, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  reverb.connect(wet).connect(master);

  const effects = ctx.createGain();
  effects.gain.value = effectsOn ? 1 : 0;
  effects.connect(master);
  effects.connect(reverb);

  const music = ctx.createGain();
  music.gain.value = musicOn ? 1 : 0;
  music.connect(master);
  music.connect(reverb);

  const ambientBus = ctx.createGain();
  ambientBus.gain.value = 0;
  ambientBus.connect(music);

  return { ctx, effects, music, ambientBus };
}

/** A short glide to a new level, so switching never clicks. */
function fade(ctx: AudioContext, node: GainNode, level: number) {
  node.gain.cancelScheduledValues(ctx.currentTime);
  node.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
}

/** A bell-like chime: the note, a soft octave, and a brief inharmonic glint. */
function chime(
  ctx: AudioContext,
  out: AudioNode,
  frequency: number,
  at: number,
  gain: number,
  duration = 0.7,
) {
  voice(ctx, out, frequency, at, { gain, duration });
  voice(ctx, out, frequency * 2, at, { gain: gain * 0.3, duration: duration * 0.5 });
  voice(ctx, out, frequency * 4.2, at, { gain: gain * 0.12, duration: duration * 0.2 });
}

function voice(
  ctx: AudioContext,
  out: AudioNode,
  frequency: number,
  at: number,
  options: { gain: number; duration: number; type?: OscillatorType; glideTo?: number },
) {
  const { gain, duration, type = 'sine', glideTo } = options;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, at + duration * 0.8);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope).connect(out);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
}

/** Starts the pad and the crickets, fading in. Returns a function that fades them out. */
function startAmbience({ ctx, ambientBus }: Graph): () => void {
  const t = ctx.currentTime;
  ambientBus.gain.cancelScheduledValues(t);
  ambientBus.gain.setTargetAtTime(1, t, AMBIENT_FADE_IN / 3);

  // The pad: low G, D and B, each a pair of slightly detuned oscillators,
  // through a low-pass filter that slowly breathes.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;
  // Six oscillators add up: at 0.014 each the bed sits about 13 dB under the
  // chimes (measured), heard more than listened to.
  const pad = ctx.createGain();
  pad.gain.value = 0.014;
  pad.connect(filter).connect(ambientBus);
  const breath = ctx.createOscillator();
  breath.frequency.value = 0.07;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 220;
  breath.connect(breathDepth).connect(filter.frequency);
  const oscillators = [breath];
  for (const note of PAD_NOTES) {
    for (const [type, detune] of [
      ['sine', -4],
      ['triangle', 4],
    ] as const) {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = note;
      oscillator.detune.value = detune;
      oscillator.connect(pad);
      oscillators.push(oscillator);
    }
  }
  oscillators.forEach((oscillator) => oscillator.start(t));

  // Crickets: short trains of high chirps, now and then, from either side.
  let cricketTimer = 0;
  const chirpLater = () => {
    cricketTimer = window.setTimeout(
      () => {
        cricket(ctx, ambientBus, ctx.currentTime);
        chirpLater();
      },
      400 + Math.random() * 1800,
    );
  };
  chirpLater();

  return () => {
    window.clearTimeout(cricketTimer);
    const now = ctx.currentTime;
    ambientBus.gain.cancelScheduledValues(now);
    ambientBus.gain.setTargetAtTime(0, now, AMBIENT_FADE_OUT / 3);
    oscillators.forEach((oscillator) => oscillator.stop(now + AMBIENT_FADE_OUT * 2));
  };
}

function cricket(ctx: AudioContext, out: AudioNode, at: number) {
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  pan.connect(out);
  const frequency = 4200 + Math.random() * 600;
  const pulses = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < pulses; i++) {
    voice(ctx, pan, frequency, at + i * 0.06, { gain: 0.012, duration: 0.035 });
  }
}

/** Decaying stereo noise: a cheap, convincing reverb tail. */
function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

/** On unless switched off. A player who muted the old single switch keeps both off. */
function readSetting(storage: Store | null, key: string): boolean {
  try {
    const value = storage?.getItem(key);
    if (value === 'on' || value === 'off') return value === 'on';
    return storage?.getItem(LEGACY_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeSetting(storage: Store | null, key: string, on: boolean) {
  try {
    storage?.setItem(key, on ? 'on' : 'off');
  } catch {
    // Not remembered, but still applied for this session.
  }
}

function deviceStorage(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
