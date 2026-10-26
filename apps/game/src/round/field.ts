import type { Field } from '@glowcatch/shared';

/** The band at the top of the frame where the HUD sits and nothing spawns (gameplay.md). */
export const HUD_BAND = 100;

/**
 * The round's logical field: the frame's CSS size right now, and the HUD band
 * plus the device's top safe-area inset. Captured once, at round start.
 */
export function measureField(frame: HTMLElement): Field {
  const width = frame.clientWidth;
  const height = frame.clientHeight;
  return { width, height, top: Math.min(HUD_BAND + safeAreaTop(frame), Math.floor(height / 2)) };
}

function safeAreaTop(frame: HTMLElement): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top, 0px)';
  frame.append(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return Math.round(inset);
}

/** How the round's logical units map onto the frame as drawn now. */
export interface View {
  sx: number;
  sy: number;
  /** For sizes: the smaller scale, so circles stay round after a resize. */
  scale: number;
}

export function viewOf(field: Field, width: number, height: number): View {
  const sx = width / field.width;
  const sy = height / field.height;
  return { sx, sy, scale: Math.min(sx, sy) };
}

/**
 * A point in the frame (CSS px from its top-left) in logical units, to 0.1 so
 * the tap log stays short. The rounded value is what the round applies and logs.
 */
export function toLogical(view: View, x: number, y: number) {
  return { x: Math.round((x / view.sx) * 10) / 10, y: Math.round((y / view.sy) * 10) / 10 };
}
