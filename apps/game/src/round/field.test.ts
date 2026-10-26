import { describe, expect, it } from 'vitest';
import { toLogical, viewOf } from './field';

const field = { width: 390, height: 844, top: 100 };

describe('viewOf', () => {
  it('is 1:1 while the frame keeps its size', () => {
    expect(viewOf(field, 390, 844)).toEqual({ sx: 1, sy: 1, scale: 1 });
  });

  it('scales sizes by the smaller axis after a resize, so circles stay round', () => {
    const view = viewOf(field, 780, 1266);
    expect(view.sx).toBe(2);
    expect(view.sy).toBe(1.5);
    expect(view.scale).toBe(1.5);
  });
});

describe('toLogical', () => {
  it('maps a tap back into the units the round was set up in', () => {
    expect(toLogical(viewOf(field, 780, 1688), 390, 844)).toEqual({ x: 195, y: 422 });
  });

  it('rounds to a tenth of a unit', () => {
    expect(toLogical(viewOf(field, 390, 844), 10.04, 20.06)).toEqual({ x: 10, y: 20.1 });
  });
});
