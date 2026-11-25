import type { DeviceProfile, Orientation, ScaleMetrics } from './types';

/** ISO/IEC 7810 ID-1 standard (bank card, credit card, Chinese 2nd-gen ID card) */
export const ISO_CARD_WIDTH_MM = 85.6;
export const ISO_CARD_HEIGHT_MM = 53.98;
export const ISO_CARD_ASPECT_RATIO = ISO_CARD_WIDTH_MM / ISO_CARD_HEIGHT_MM;

/** Standard CSS reference assumption (only accurate on ~96 PPI unscaled screens) */
export const DEFAULT_FALLBACK_CSS_PX_PER_MM = 96 / 25.4; // ~3.7795

export function clampCssPxPerMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_FALLBACK_CSS_PX_PER_MM;
  }
  return Math.min(20, Math.max(1.5, Number(value.toFixed(4))));
}

export function getMonitorKey(screenWidth: number, screenHeight: number, dpr: number): string {
  const normalizedDpr = Number(dpr.toFixed(2));
  return `${Math.round(screenWidth)}x${Math.round(screenHeight)}@${normalizedDpr}`;
}

export function estimateCssPxPerMmFromPreset(
  screenWidth: number,
  screenHeight: number,
  diagonalInches: number,
): number {
  if (screenWidth <= 0 || screenHeight <= 0 || diagonalInches <= 0) {
    return DEFAULT_FALLBACK_CSS_PX_PER_MM;
  }
  const diagonalCssPx = Math.hypot(screenWidth, screenHeight);
  const diagonalMm = diagonalInches * 25.4;
  return clampCssPxPerMm(diagonalCssPx / diagonalMm);
}

/**
 * Generic physical span calibration: user aligns an on-screen span of `spanCssPx`
 * to a real object/edge whose physical length is `physicalMm`.
 */
export function calcCssPxPerMmFromSpan(spanCssPx: number, physicalMm: number): number {
  if (spanCssPx <= 0 || physicalMm <= 0) {
    return DEFAULT_FALLBACK_CSS_PX_PER_MM;
  }
  return clampCssPxPerMm(spanCssPx / physicalMm);
}

/**
 * Bank card / ID card calibration: user matches on-screen card width to physical 85.60 mm card.
 */
export function calcCssPxPerMmFromCard(cardWidthCssPx: number): number {
  return calcCssPxPerMmFromSpan(cardWidthCssPx, ISO_CARD_WIDTH_MM);
}

/**
 * Physical ruler calibration: user measures an on-screen box of `boxCssPx` CSS pixels.
 */
export function calcCssPxPerMmFromRuler(boxCssPx: number, measuredMm: number): number {
  return calcCssPxPerMmFromSpan(boxCssPx, measuredMm);
}

/**
 * Real phone screen-hold calibration: user matches on-screen span to a known device's active display width.
 */
export function calcCssPxPerMmFromPhone(
  rectWidthCssPx: number,
  device: Pick<DeviceProfile, 'cssWidth' | 'cssHeight' | 'diagonalInches'>,
): number {
  const { widthMm } = getDevicePhysicalSizeMm(device);
  return calcCssPxPerMmFromSpan(rectWidthCssPx, widthMm);
}

export function getDevicePhysicalSizeMm(
  device: Pick<DeviceProfile, 'cssWidth' | 'cssHeight' | 'diagonalInches'>,
): { widthMm: number; heightMm: number } {
  const diagCss = Math.hypot(device.cssWidth, device.cssHeight);
  if (diagCss <= 0 || device.diagonalInches <= 0) {
    return { widthMm: 70, heightMm: 150 };
  }
  const diagMm = device.diagonalInches * 25.4;
  return {
    widthMm: Number(((diagMm * device.cssWidth) / diagCss).toFixed(2)),
    heightMm: Number(((diagMm * device.cssHeight) / diagCss).toFixed(2)),
  };
}

/**
 * Computes exact CSS transform scale and desktop pixel footprint required
 * so the simulated device renders at 1:1 physical millimeters while preserving
 * the target device's CSS logical viewport width & responsive breakpoints.
 */
export function calcTrueScaleFactor(
  device: Pick<DeviceProfile, 'cssWidth' | 'cssHeight' | 'diagonalInches'>,
  cssPxPerMm: number,
  orientation: Orientation = 'portrait',
): ScaleMetrics {
  const { widthMm, heightMm } = getDevicePhysicalSizeMm(device);
  const isPortrait = orientation === 'portrait';

  const viewportWidthPx = isPortrait ? device.cssWidth : device.cssHeight;
  const viewportHeightPx = isPortrait ? device.cssHeight : device.cssWidth;
  const physicalWidthMm = isPortrait ? widthMm : heightMm;
  const physicalHeightMm = isPortrait ? heightMm : widthMm;

  const safePxPerMm = clampCssPxPerMm(cssPxPerMm);
  const diagCss = Math.hypot(device.cssWidth, device.cssHeight);
  const rawScale =
    diagCss > 0 && device.diagonalInches > 0
      ? (device.diagonalInches * 25.4 * safePxPerMm) / diagCss
      : (physicalWidthMm * safePxPerMm) / viewportWidthPx;
  const desktopWidthPx = viewportWidthPx * rawScale;
  const desktopHeightPx = viewportHeightPx * rawScale;

  return {
    scale: Number(rawScale.toFixed(5)),
    physicalWidthMm,
    physicalHeightMm,
    viewportWidthPx,
    viewportHeightPx,
    desktopWidthPx: Number(desktopWidthPx.toFixed(2)),
    desktopHeightPx: Number(desktopHeightPx.toFixed(2)),
  };
}
