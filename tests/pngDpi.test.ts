import { describe, expect, it } from 'vitest';
import { injectPngPhysDpi, parsePngPhysDpi } from '../src/simulator/utils/pngDpi';

// Minimal valid 1×1 transparent PNG
const MINIMAL_1X1_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

describe('pngDpi', () => {
  it('injects and parses physical DPI via pHYs chunk', () => {
    const out = injectPngPhysDpi(MINIMAL_1X1_PNG, 305);
    const parsed = parsePngPhysDpi(out);
    expect(parsed).not.toBeNull();
    expect(parsed?.unitSpecifier).toBe(1);
    expect(parsed?.dpi).toBe(305);
  });

  it('replaces an existing pHYs chunk rather than duplicating it', () => {
    const first = injectPngPhysDpi(MINIMAL_1X1_PNG, 150);
    const second = injectPngPhysDpi(first, 326);
    const parsed = parsePngPhysDpi(second);
    expect(parsed?.dpi).toBe(326);
    expect(second.length).toBe(first.length);
  });
});
