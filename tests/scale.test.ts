import { describe, expect, it } from 'vitest';
import { PRESET_DEVICES } from '../src/config/devices';
import {
  ISO_CARD_WIDTH_MM,
  calcCssPxPerMmFromCard,
  calcCssPxPerMmFromPhone,
  calcCssPxPerMmFromRuler,
  calcCssPxPerMmFromSpan,
  calcTrueScaleFactor,
  estimateCssPxPerMmFromPreset,
  getDevicePhysicalSizeMm,
  getMonitorKey,
} from '../src/shared/scale';

describe('scale & calibration math', () => {
  it('computes monitor profile keys deterministically', () => {
    expect(getMonitorKey(1512, 982, 2)).toBe('1512x982@2');
    expect(getMonitorKey(2560, 1440, 1.5)).toBe('2560x1440@1.5');
  });

  it('estimates CSS px/mm from monitor preset accurately for 14.2" MacBook Pro', () => {
    const pxPerMm = estimateCssPxPerMmFromPreset(1512, 982, 14.2);
    expect(pxPerMm).toBeCloseTo(5.0, 1);
  });

  it('calibrates from ISO 7810 ID-1 bank card width (85.60 mm)', () => {
    const simulatedScreenPxPerMm = 4.8;
    const matchedCardWidthPx = ISO_CARD_WIDTH_MM * simulatedScreenPxPerMm;
    expect(calcCssPxPerMmFromCard(matchedCardWidthPx)).toBeCloseTo(simulatedScreenPxPerMm, 3);
  });

  it('calibrates from generic physical edge span (body width or long edge)', () => {
    const iphone17Pm = PRESET_DEVICES.find((d) => d.id === 'iphone-17-pro-max')!;
    expect(calcCssPxPerMmFromSpan(iphone17Pm.bodyWidthMm * 3.6, iphone17Pm.bodyWidthMm)).toBeCloseTo(
      3.6,
      3,
    );
    expect(
      calcCssPxPerMmFromSpan(iphone17Pm.bodyHeightMm * 3.6, iphone17Pm.bodyHeightMm),
    ).toBeCloseTo(3.6, 3);
  });

  it('calibrates from physical ruler measurement of 200 CSS px square', () => {
    expect(calcCssPxPerMmFromRuler(200, 40)).toBeCloseTo(5.0, 4);
    expect(calcCssPxPerMmFromRuler(200, 52.9)).toBeCloseTo(3.7807, 3);
  });

  it('calibrates from real phone active display width', () => {
    const iphone16 = PRESET_DEVICES.find((d) => d.id === 'iphone-16')!;
    const { widthMm } = getDevicePhysicalSizeMm(iphone16);
    expect(widthMm).toBeGreaterThan(64);
    expect(widthMm).toBeLessThan(66);

    const truePxPerMm = 4.6;
    const rectCssPx = widthMm * truePxPerMm;
    expect(calcCssPxPerMmFromPhone(rectCssPx, iphone16)).toBeCloseTo(truePxPerMm, 2);
  });

  it('keeps scale invariant between portrait and landscape while swapping physical/CSS axes', () => {
    const iphone17 = PRESET_DEVICES.find((d) => d.id === 'iphone-17')!;
    const pxPerMm = 5.0;

    const portrait = calcTrueScaleFactor(iphone17, pxPerMm, 'portrait');
    const landscape = calcTrueScaleFactor(iphone17, pxPerMm, 'landscape');

    expect(portrait.scale).toBeCloseTo(landscape.scale, 5);
    expect(portrait.viewportWidthPx).toBe(iphone17.cssWidth);
    expect(portrait.viewportHeightPx).toBe(iphone17.cssHeight);
    expect(landscape.viewportWidthPx).toBe(iphone17.cssHeight);
    expect(landscape.viewportHeightPx).toBe(iphone17.cssWidth);
    expect(portrait.physicalWidthMm).toBeCloseTo(landscape.physicalHeightMm, 2);
    expect(portrait.physicalHeightMm).toBeCloseTo(landscape.physicalWidthMm, 2);
    expect(portrait.desktopWidthPx).toBeCloseTo(portrait.physicalWidthMm * pxPerMm, 1);
  });
});
