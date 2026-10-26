import { describe, expect, it } from 'vitest';
import { createStepper } from './stepper';

const ticksOver = (frameMs: number, totalMs: number) => {
  const stepper = createStepper();
  let ticks = 0;
  for (let t = 0; t < totalMs - 1e-9; t += frameMs) ticks += stepper.advance(frameMs);
  return ticks;
};

describe('createStepper', () => {
  it('runs 100 ticks a second at 60 Hz and at 120 Hz alike', () => {
    expect(ticksOver(1000 / 60, 1000)).toBe(100);
    expect(ticksOver(1000 / 120, 1000)).toBe(100);
    expect(ticksOver(1000 / 144, 3000)).toBe(300);
  });

  it('carries part-ticks over to the next frame', () => {
    const stepper = createStepper();
    expect(stepper.advance(15)).toBe(1);
    expect(stepper.advance(15)).toBe(2);
  });

  it('caps the catch-up after a stall and drops the rest', () => {
    const stepper = createStepper(10);
    expect(stepper.advance(1000)).toBe(10);
    expect(stepper.advance(10)).toBe(1);
  });

  it('starts clean after a reset', () => {
    const stepper = createStepper();
    stepper.advance(9);
    stepper.reset();
    expect(stepper.advance(9)).toBe(0);
  });
});
