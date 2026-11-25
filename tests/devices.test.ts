import { describe, expect, it } from 'vitest';
import { PRESET_DEVICES, buildCustomDeviceProfile } from '../src/config/devices';
import { getDevicePhysicalSizeMm } from '../src/shared/scale';

describe('2026 top 10 preset device catalog', () => {
  it('contains exactly 10 deduplicated global devices (8 phones + 2 tablets)', () => {
    expect(PRESET_DEVICES).toHaveLength(10);
    expect(PRESET_DEVICES.filter((d) => d.category === 'phone')).toHaveLength(8);
    expect(PRESET_DEVICES.filter((d) => d.category === 'tablet')).toHaveLength(2);
  });

  it('has no duplicate (diagonalInches, cssWidth, cssHeight, dpr) combinations', () => {
    const signatures = PRESET_DEVICES.map(
      (d) => `${d.diagonalInches}|${d.cssWidth}x${d.cssHeight}@${d.dpr}`,
    );
    expect(new Set(signatures).size).toBe(PRESET_DEVICES.length);
  });

  it('provides valid outer body dimensions strictly larger than active screen dimensions', () => {
    for (const device of PRESET_DEVICES) {
      const { widthMm, heightMm } = getDevicePhysicalSizeMm(device);
      expect(device.bodyWidthMm).toBeGreaterThan(widthMm);
      expect(device.bodyHeightMm).toBeGreaterThan(heightMm);
    }
  });

  it('provides accurate per-device bezel & cutout geometry', () => {
    const pm = PRESET_DEVICES.find((d) => d.id === 'iphone-17-pro-max')!;
    expect(pm.bezel.cutout.type).toBe('dynamic-island');
    expect(pm.bezel.cutout.width).toBe(126);
    expect(pm.bezel.cutout.height).toBe(36);
    expect(pm.browserChrome.topStatusBar).toBeGreaterThanOrEqual(pm.bezel.cutout.topOffset + pm.bezel.cutout.height);

    const ultra = PRESET_DEVICES.find((d) => d.id === 'galaxy-s26-ultra')!;
    expect(ultra.bezel.outerRadius).toBeLessThan(20);
    expect(ultra.bezel.cutout.type).toBe('punch-hole');
  });

  it('provides valid User-Agent, Client Hints, and positive browser chrome bars for every device', () => {
    for (const device of PRESET_DEVICES) {
      expect(device.userAgent.length).toBeGreaterThan(20);
      expect(['?0', '?1']).toContain(device.secChUaMobile);
      expect(device.secChUaPlatform).toMatch(/^"(iOS|Android)"$/);
      expect(device.browserChrome.topStatusBar).toBeGreaterThan(0);
      expect(device.browserChrome.topUrlBar).toBeGreaterThan(0);
      expect(device.browserChrome.bottomBar).toBeGreaterThan(0);
    }
  });

  it('builds valid custom device profiles with outer body dimensions', () => {
    const custom = buildCustomDeviceProfile({
      name: 'Xiaomi 16 Pro',
      category: 'phone',
      os: 'android',
      cssWidth: 412,
      cssHeight: 915,
      dpr: 3,
      diagonalInches: 6.7,
    });
    expect(custom.isCustom).toBe(true);
    expect(custom.secChUaPlatform).toBe('"Android"');
    expect(custom.secChUaMobile).toBe('?1');
    expect(custom.ppi).toBeGreaterThan(400);
    expect(custom.bodyWidthMm).toBeGreaterThan(70);
    expect(custom.bodyHeightMm).toBeGreaterThan(150);
  });
});
