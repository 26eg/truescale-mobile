import type { DeviceBezelSpec, DeviceProfile } from '../shared/types';

const IOS_PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

const buildAndroidUa = (model: string): string =>
  `Mozilla/5.0 (Linux; Android 16; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36`;

const DYNAMIC_ISLAND_BEZEL: DeviceBezelSpec = {
  bezelWidth: 12,
  outerRadius: 54,
  innerRadius: 43,
  cutout: {
    type: 'dynamic-island',
    width: 126,
    height: 36,
    topOffset: 11,
  },
};

const NOTCH_BEZEL: DeviceBezelSpec = {
  bezelWidth: 13,
  outerRadius: 50,
  innerRadius: 38,
  cutout: {
    type: 'notch',
    width: 150,
    height: 30,
    topOffset: 0,
  },
};

const ROUND_ANDROID_BEZEL: DeviceBezelSpec = {
  bezelWidth: 10,
  outerRadius: 40,
  innerRadius: 30,
  cutout: {
    type: 'punch-hole',
    width: 12,
    height: 12,
    topOffset: 11,
  },
};

const ULTRA_SQUARE_BEZEL: DeviceBezelSpec = {
  bezelWidth: 9,
  outerRadius: 16,
  innerRadius: 8,
  cutout: {
    type: 'punch-hole',
    width: 12,
    height: 12,
    topOffset: 11,
  },
};

const IPAD_LANDSCAPE_CAM_BEZEL: DeviceBezelSpec = {
  bezelWidth: 20,
  outerRadius: 30,
  innerRadius: 16,
  cutout: {
    type: 'tablet-bezel',
    width: 9,
    height: 9,
    topOffset: 6,
    tabletCameraEdge: 'landscape-top',
  },
};

const IPAD_PORTRAIT_CAM_BEZEL: DeviceBezelSpec = {
  bezelWidth: 20,
  outerRadius: 30,
  innerRadius: 16,
  cutout: {
    type: 'tablet-bezel',
    width: 9,
    height: 9,
    topOffset: 6,
    tabletCameraEdge: 'portrait-top',
  },
};

/**
 * 2026 Jan–Nov Global Top 10 deduplicated mobile & tablet presets
 * (ranked by global shipments & distinct physical size / CSS viewport / DPR).
 */
export const PRESET_DEVICES: DeviceProfile[] = [
  {
    id: 'iphone-17',
    name: 'iPhone 17',
    brand: 'Apple',
    category: 'phone',
    os: 'ios',
    cssWidth: 402,
    cssHeight: 874,
    dpr: 3,
    diagonalInches: 6.3,
    ppi: 460,
    bodyWidthMm: 71.5,
    bodyHeightMm: 149.6,
    userAgent: IOS_PHONE_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?1',
    secChUaModel: '"iPhone 17"',
    frameStyle: 'dynamic-island',
    bezel: DYNAMIC_ISLAND_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 59,
      topUrlBar: 44,
      bottomBar: 46,
    },
    noteEn: '2026 #1 global bestseller (matches iPhone 17 Pro specs)',
    noteZh: '2026 全球销量第 1（同规格覆盖 iPhone 17 Pro）',
  },
  {
    id: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    brand: 'Apple',
    category: 'phone',
    os: 'ios',
    cssWidth: 440,
    cssHeight: 956,
    dpr: 3,
    diagonalInches: 6.9,
    ppi: 460,
    bodyWidthMm: 77.6,
    bodyHeightMm: 163.0,
    userAgent: IOS_PHONE_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?1',
    secChUaModel: '"iPhone 17 Pro Max"',
    frameStyle: 'dynamic-island',
    bezel: DYNAMIC_ISLAND_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 59,
      topUrlBar: 44,
      bottomBar: 46,
    },
    noteEn: '6.9" large flagship iPhone',
    noteZh: '6.9 英寸大屏旗舰 iPhone',
  },
  {
    id: 'galaxy-s26-ultra',
    name: 'Galaxy S26 Ultra',
    brand: 'Samsung',
    category: 'phone',
    os: 'android',
    cssWidth: 412,
    cssHeight: 915,
    dpr: 3.5,
    diagonalInches: 6.9,
    ppi: 498,
    bodyWidthMm: 77.6,
    bodyHeightMm: 162.8,
    userAgent: buildAndroidUa('SM-S948B'),
    secChUaPlatform: '"Android"',
    secChUaMobile: '?1',
    secChUaModel: '"SM-S948B"',
    frameStyle: 'punch-hole',
    bezel: ULTRA_SQUARE_BEZEL,
    browserChrome: {
      browserName: 'Chrome',
      topStatusBar: 34,
      topUrlBar: 54,
      bottomBar: 20,
    },
    noteEn: '2026 #1 global Android flagship',
    noteZh: '2026 全球销量第 1 安卓旗舰',
  },
  {
    id: 'iphone-17e',
    name: 'iPhone 17e',
    brand: 'Apple',
    category: 'phone',
    os: 'ios',
    cssWidth: 390,
    cssHeight: 844,
    dpr: 3,
    diagonalInches: 6.1,
    ppi: 460,
    bodyWidthMm: 71.5,
    bodyHeightMm: 146.7,
    userAgent: IOS_PHONE_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?1',
    secChUaModel: '"iPhone 17e"',
    frameStyle: 'notch',
    bezel: NOTCH_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 47,
      topUrlBar: 44,
      bottomBar: 46,
    },
    noteEn: 'Classic 390px viewport (also covers iPhone 13/14)',
    noteZh: '经典 390px 视口（同时覆盖 iPhone 13/14 存量机）',
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    brand: 'Apple',
    category: 'phone',
    os: 'ios',
    cssWidth: 393,
    cssHeight: 852,
    dpr: 3,
    diagonalInches: 6.1,
    ppi: 461,
    bodyWidthMm: 71.6,
    bodyHeightMm: 147.6,
    userAgent: IOS_PHONE_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?1',
    secChUaModel: '"iPhone 16"',
    frameStyle: 'dynamic-island',
    bezel: DYNAMIC_ISLAND_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 59,
      topUrlBar: 44,
      bottomBar: 46,
    },
    noteEn: '6.1" Dynamic Island mainstream (covers iPhone 15)',
    noteZh: '6.1 英寸灵动岛主力（同规格覆盖 iPhone 15）',
  },
  {
    id: 'galaxy-a17-5g',
    name: 'Galaxy A17 5G',
    brand: 'Samsung',
    category: 'phone',
    os: 'android',
    cssWidth: 360,
    cssHeight: 780,
    dpr: 3,
    diagonalInches: 6.7,
    ppi: 385,
    bodyWidthMm: 77.9,
    bodyHeightMm: 164.4,
    userAgent: buildAndroidUa('SM-A176B'),
    secChUaPlatform: '"Android"',
    secChUaMobile: '?1',
    secChUaModel: '"SM-A176B"',
    frameStyle: 'punch-hole',
    bezel: ROUND_ANDROID_BEZEL,
    browserChrome: {
      browserName: 'Chrome',
      topStatusBar: 34,
      topUrlBar: 54,
      bottomBar: 18,
    },
    noteEn: 'High-volume 6.7" mainstream Android (matches A56)',
    noteZh: '全球走量 6.7 英寸大屏安卓（同规格覆盖 Galaxy A56）',
  },
  {
    id: 'galaxy-s26',
    name: 'Galaxy S26',
    brand: 'Samsung',
    category: 'phone',
    os: 'android',
    cssWidth: 360,
    cssHeight: 780,
    dpr: 3,
    diagonalInches: 6.3,
    ppi: 411,
    bodyWidthMm: 70.6,
    bodyHeightMm: 147.0,
    userAgent: buildAndroidUa('SM-S941B'),
    secChUaPlatform: '"Android"',
    secChUaMobile: '?1',
    secChUaModel: '"SM-S941B"',
    frameStyle: 'punch-hole',
    bezel: ROUND_ANDROID_BEZEL,
    browserChrome: {
      browserName: 'Chrome',
      topStatusBar: 34,
      topUrlBar: 54,
      bottomBar: 18,
    },
    noteEn: 'Compact 6.3" Android flagship (higher PPI than A17)',
    noteZh: '6.3 英寸紧凑安卓旗舰（物理尺寸与 PPI 均异于 A17）',
  },
  {
    id: 'pixel-10',
    name: 'Google Pixel 10',
    brand: 'Google',
    category: 'phone',
    os: 'android',
    cssWidth: 412,
    cssHeight: 924,
    dpr: 2.625,
    diagonalInches: 6.3,
    ppi: 422,
    bodyWidthMm: 72.0,
    bodyHeightMm: 152.8,
    userAgent: buildAndroidUa('Pixel 10'),
    secChUaPlatform: '"Android"',
    secChUaMobile: '?1',
    secChUaModel: '"Pixel 10"',
    frameStyle: 'punch-hole',
    bezel: ROUND_ANDROID_BEZEL,
    browserChrome: {
      browserName: 'Chrome',
      topStatusBar: 34,
      topUrlBar: 54,
      bottomBar: 20,
    },
    noteEn: 'Standard 412px mid-size Android (2.625× DPR)',
    noteZh: '标准 412px 视口中屏安卓代表（2.625× DPR）',
  },
  {
    id: 'ipad-11',
    name: 'iPad (11th Gen)',
    brand: 'Apple',
    category: 'tablet',
    os: 'ios',
    cssWidth: 820,
    cssHeight: 1180,
    dpr: 2,
    diagonalInches: 11.0,
    ppi: 264,
    bodyWidthMm: 179.5,
    bodyHeightMm: 248.6,
    userAgent: IPAD_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?0',
    secChUaModel: '"iPad"',
    frameStyle: 'tablet',
    bezel: IPAD_LANDSCAPE_CAM_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 24,
      topUrlBar: 52,
      bottomBar: 20,
    },
    noteEn: 'Top-selling 11" tablet (matches iPad Air 11" specs)',
    noteZh: '全球最热销 11 英寸平板（同规格覆盖 iPad Air 11"）',
  },
  {
    id: 'ipad-mini-7',
    name: 'iPad mini (7th Gen)',
    brand: 'Apple',
    category: 'tablet',
    os: 'ios',
    cssWidth: 744,
    cssHeight: 1133,
    dpr: 2,
    diagonalInches: 8.3,
    ppi: 326,
    bodyWidthMm: 134.8,
    bodyHeightMm: 195.4,
    userAgent: IPAD_UA,
    secChUaPlatform: '"iOS"',
    secChUaMobile: '?0',
    secChUaModel: '"iPad mini"',
    frameStyle: 'tablet',
    bezel: IPAD_PORTRAIT_CAM_BEZEL,
    browserChrome: {
      browserName: 'Safari',
      topStatusBar: 24,
      topUrlBar: 52,
      bottomBar: 20,
    },
    noteEn: 'Compact 8.3" tablet (fits 1:1 nicely on laptops)',
    noteZh: '8.3 英寸便携平板（笔记本屏幕即可完整 1:1 显示）',
  },
];

export const DEFAULT_DEVICE_ID = 'iphone-17';

export function buildCustomDeviceProfile(input: {
  id?: string;
  name: string;
  category: 'phone' | 'tablet';
  os: 'ios' | 'android';
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  diagonalInches: number;
}): DeviceProfile {
  const diagCss = Math.hypot(input.cssWidth, input.cssHeight);
  const ppi = Math.round((diagCss * input.dpr) / input.diagonalInches);
  const diagMm = input.diagonalInches * 25.4;
  const activeW = diagCss > 0 ? (diagMm * input.cssWidth) / diagCss : 68;
  const activeH = diagCss > 0 ? (diagMm * input.cssHeight) / diagCss : 148;
  const isIos = input.os === 'ios';
  const isTablet = input.category === 'tablet';

  return {
    id: input.id ?? `custom-${Date.now()}`,
    name: input.name.trim(),
    brand: 'Custom',
    category: input.category,
    os: input.os,
    cssWidth: Math.round(input.cssWidth),
    cssHeight: Math.round(input.cssHeight),
    dpr: input.dpr,
    diagonalInches: input.diagonalInches,
    ppi,
    bodyWidthMm: Number((activeW + (isTablet ? 18 : 4.5)).toFixed(1)),
    bodyHeightMm: Number((activeH + (isTablet ? 18 : 7.0)).toFixed(1)),
    userAgent: isIos ? (isTablet ? IPAD_UA : IOS_PHONE_UA) : buildAndroidUa(input.name.trim()),
    secChUaPlatform: isIos ? '"iOS"' : '"Android"',
    secChUaMobile: isTablet ? '?0' : '?1',
    secChUaModel: `"${input.name.trim().replace(/"/g, '')}"`,
    frameStyle: isTablet ? 'tablet' : isIos ? 'dynamic-island' : 'punch-hole',
    bezel: isTablet ? IPAD_PORTRAIT_CAM_BEZEL : isIos ? DYNAMIC_ISLAND_BEZEL : ROUND_ANDROID_BEZEL,
    browserChrome: isIos
      ? {
          browserName: 'Safari',
          topStatusBar: isTablet ? 24 : 59,
          topUrlBar: isTablet ? 52 : 44,
          bottomBar: isTablet ? 20 : 46,
        }
      : {
          browserName: 'Chrome',
          topStatusBar: isTablet ? 24 : 34,
          topUrlBar: 54,
          bottomBar: 18,
        },
    isCustom: true,
  };
}
