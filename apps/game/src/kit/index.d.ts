// Glowcatch UI kit — plain DOM + Canvas. Every component is a function (props) => HTMLElement.
// Load order: tokens.css, components/bundle.css, components/bundle.js (assigns window.Glowcatch). No framework.

export type IconName = 'play' | 'replay' | 'share' | 'trophy' | 'pause' | 'sound-on' | 'sound-off' | 'close' | 'spark' | 'frost' | 'offline' | 'alert' | 'settings';
export type FireflyKind = 'normal' | 'lantern' | 'frost' | 'swarm';

export interface ButtonProps {
  /** Visible label; for iconOnly buttons it becomes the aria-label. Sentence case, verb first. */
  label: string;
  /** primary = glow pill (one per screen); secondary = outlined; ghost = text only. Default primary. */
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  /** Square icon button on sky-raised (Pause, Sound). Requires label for screen readers. */
  iconOnly?: boolean;
  /** lg = 60px tall, for the title screen's Play. */
  size?: 'md' | 'lg';
  block?: boolean;
  disabled?: boolean;
  /** Shows a spinner and disables the button (Share while shareAsync is pending). */
  busy?: boolean;
  /** For toggles (Sound): sets aria-pressed. */
  pressed?: boolean;
  onClick?: (e: MouseEvent) => void;
}
export declare function Button(props: ButtonProps): HTMLButtonElement;

export interface IconProps { name: IconName; size?: number }
/** 24×24 stroke icon in currentColor. Also accepts a bare name: Icon('share'). */
export declare function Icon(props: IconProps | IconName): SVGSVGElement;

export interface ChipProps {
  label: string;
  /** glow = Best; lime = New best / streak; coral = time or error; neutral = anything else. */
  tone?: 'neutral' | 'glow' | 'lime' | 'coral' | 'frost';
  icon?: IconName;
  /** Pop in with ease-pop when it first appears. */
  pop?: boolean;
}
export declare function Chip(props: ChipProps): HTMLSpanElement;

export interface ScoreHudProps {
  score?: number;
  /** Seconds left, may be fractional; the moon is placed continuously along the arc. */
  timeLeft?: number;
  /** Round length in seconds. Default 30. */
  total?: number;
  /** Consecutive catches; pips from 1, a ×2 chip from 5, ×3 from 10. */
  streak?: number;
  /** 0 → 1: share of the combo clock left; drives the streak bar. */
  streakLeft?: number;
  /** ms of Frost freeze remaining; > 0 shows the frozen timer. */
  frozen?: number;
  /** Seconds at which the moon and number turn coral. Default 5. */
  lowAt?: number;
  onPause?: () => void;
}
/** Returns an element with update(next: Partial<ScoreHudProps>) — call it every frame or on change. */
export declare function ScoreHud(props?: ScoreHudProps): HTMLDivElement & { update(next: Partial<ScoreHudProps>): void };

export interface FireflyProps {
  /** Start diameter in CSS px. Default 72 (token firefly-start). */
  diameter?: number;
  /** 1 = just spawned, 0 = gone. Visible radius = r × life^0.7. */
  life?: number;
  /** 0 → 1 progress of the catch burst; null when not caught. */
  caught?: number | null;
  /** Loop spawn → shrink → catch for documentation. */
  animate?: boolean;
  kind?: FireflyKind;
  label?: string;
}
/** A single firefly on its own canvas, for docs and menus. In the game, call drawFirefly on the play canvas. */
export declare function Firefly(props?: FireflyProps): HTMLCanvasElement & { stop(): void };

export interface CountdownProps { value?: 3 | 2 | 1 | 0 | 'Go'; hint?: string; /** Skip the zoom-in animation (docs, reduced motion). */ still?: boolean }
export declare function Countdown(props?: CountdownProps): HTMLDivElement;

export interface TitleScreenProps {
  /** Render without the intro animation (docs, screenshots). */
  still?: boolean;
  /** The player's saved best; the Best chip is hidden when 0 or absent (first session). */
  best?: number;
  tagline?: string;
  playLabel?: string;
  onPlay?: () => void;
  onLeaderboard?: () => void;
}
export declare function TitleScreen(props?: TitleScreenProps): HTMLDivElement;

export interface PlayFieldProps {
  score?: number;
  timeLeft?: number;
  /** Seconds of play to start at (overrides timeLeft). */
  elapsed?: number;
  streak?: number;
  /** ms of freeze to start with. */
  frozen?: number;
  /** Run the reference round (pace, combos, bonuses). The game owns its own loop. */
  demo?: boolean;
  /** Force the round clock on or off; defaults on for demo without ambient or layer. */
  clock?: boolean;
  /** Restart a fresh round 2 s after the end. Default true. */
  loop?: boolean;
  /** Fewer, smaller, dimmer fireflies: the living backdrop behind the title screen. */
  ambient?: boolean;
  /** An element (Countdown, GameOver, …) shown over the scrim. */
  layer?: HTMLElement | null;
}
export declare function PlayField(props?: PlayFieldProps): HTMLDivElement & { stop(): void; hud: ReturnType<typeof ScoreHud> | null; spawn(kind?: FireflyKind): void };

export interface LeaderboardEntry {
  rank?: number;
  name: string;
  score: number;
  /** FBInstant.player.getPhoto() URL; falls back to initials. */
  photo?: string;
  isPlayer?: boolean;
}
export interface LeaderboardProps {
  state?: 'ready' | 'loading' | 'empty' | 'error' | 'offline';
  /** Up to 10 rows, ranked by the server. */
  entries?: LeaderboardEntry[];
  /** The player's own row when they are outside the top 10; pinned under a gap. */
  playerEntry?: LeaderboardEntry;
  title?: string;
  scope?: string;
  hideHeader?: boolean;
  onRetry?: () => void;
}
export declare function Leaderboard(props?: LeaderboardProps): HTMLElement;

export interface GameOverProps {
  score: number;
  /** Best after this round (already includes this score). */
  best: number;
  isNewBest?: boolean;
  /** Highest combo multiplier reached (1–3); shown as ×N. */
  topCombo?: number;
  /** Fireflies caught this round. */
  caught?: number;
  /** Global rank from the server, if known. */
  rank?: number;
  /** sent = accepted; failed = show retry; offline = kept locally. */
  submit?: 'sending' | 'sent' | 'failed' | 'offline';
  sharing?: boolean;
  leaderboard?: LeaderboardProps;
  onShare?: () => void;
  onPlayAgain?: () => void;
  onRetrySubmit?: () => void;
}
export declare function GameOver(props: GameOverProps): HTMLDivElement;

export interface ShareCardProps { score: number; name?: string }
/** Preview of the 1200×630 share image. */
export declare function ShareCard(props: ShareCardProps): HTMLCanvasElement;

export interface NoticeProps {
  tone?: 'info' | 'error' | 'offline';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
export declare function Notice(props: NoticeProps): HTMLDivElement;

export interface FloatTextProps { text: string; tone?: 'ink' | 'lime' | 'glow' | 'frost'; x?: number; y?: number; icon?: IconName; big?: boolean; parent?: HTMLElement }
/** A popup that rises from a catch and removes itself after dur-float. */
export declare function FloatText(props: FloatTextProps): HTMLSpanElement;

export interface PhaseBannerProps { name?: string; step?: string; hint?: string; still?: boolean; parent?: HTMLElement }
export declare function PhaseBanner(props?: PhaseBannerProps): HTMLDivElement;

export interface BonusLegendProps { /** null hides the heading. */ title?: string | null }
export declare function BonusLegend(props?: BonusLegendProps): HTMLElement;

/** Rules — the same numbers the game and the server use. */
export interface Difficulty { pace: number; phase: 'dusk' | 'night' | 'midnight'; phaseName: string; phaseIndex: 0 | 1 | 2; spawnEvery: number; maxAlive: number; life: number; sizeScale: number; drift: number; bonusEvery: number; streakWindow: number }
/** pace = clamp(0.4 × elapsed/total + 0.6 × score/90). Frozen time is not elapsed. */
export declare function pace(elapsed: number, score: number, total?: number): number;
export declare function difficulty(elapsed: number, total?: number, score?: number): Difficulty;
/** ×1 for streaks 0–4, ×2 from 5, ×3 from 10. */
export declare function comboFor(streak: number): 1 | 2 | 3;
/** Points for a catch; streak includes this catch. Lantern is a flat 5. */
export declare function pointsFor(kind: FireflyKind | 'swarm-mote', streak: number): number;
export declare const BONUSES: {
  lantern: { name: string; effect: string; points: number; life: number; sizeScale: number; weight: number };
  frost: { name: string; effect: string; freezeMs: number; life: number; sizeScale: number; weight: number; maxPerRound: number };
  swarm: { name: string; effect: string; count: number; windowMs: number; life: number; sizeScale: number; moteLife: number; moteScale: number; weight: number };
};

/** Canvas helpers. Colours come from tokens.css at call time. */
export declare function drawField(ctx: CanvasRenderingContext2D, w: number, h: number, opts?: { time?: number; seed?: number; phase?: 0 | 1 | 2; frozen?: number; heat?: number; hot?: boolean }): void;
export declare function drawFirefly(ctx: CanvasRenderingContext2D, f: { x: number; y: number; r: number; life?: number; caught?: number | null; seed?: number; kind?: FireflyKind }, now?: number): void;
/** Draws the share image; pass canvas.toDataURL('image/png') to FBInstant.shareAsync({ image }). */
export declare function renderShareImage(opts: { score: number; name?: string; canvas?: HTMLCanvasElement; width?: number; height?: number }): HTMLCanvasElement;
export declare function token(name: string, el?: Element): string;

declare global {
  interface Window {
    Glowcatch: {
      Button: typeof Button; Icon: typeof Icon; Chip: typeof Chip; ScoreHud: typeof ScoreHud; Firefly: typeof Firefly;
      Countdown: typeof Countdown; TitleScreen: typeof TitleScreen; PlayField: typeof PlayField; GameOver: typeof GameOver;
      Leaderboard: typeof Leaderboard; ShareCard: typeof ShareCard; Notice: typeof Notice;
      FloatText: typeof FloatText; PhaseBanner: typeof PhaseBanner; BonusLegend: typeof BonusLegend;
      pace: typeof pace; difficulty: typeof difficulty; comboFor: typeof comboFor; pointsFor: typeof pointsFor; BONUSES: typeof BONUSES;
      drawField: typeof drawField; drawFirefly: typeof drawFirefly; renderShareImage: typeof renderShareImage; token: typeof token;
    };
  }
}
