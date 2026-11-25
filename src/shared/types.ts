export type DeviceCategory = 'phone' | 'tablet';
export type DeviceOS = 'ios' | 'android';
export type FrameStyle = 'dynamic-island' | 'notch' | 'punch-hole' | 'tablet';
export type Orientation = 'portrait' | 'landscape';
export type ViewScaleMode = 'true-size' | 'pixel-crisp' | 'fit-window';
export type CalibrationMethod = 'preset' | 'card' | 'ruler' | 'phone' | 'custom';
export type LanguageSetting = 'auto' | 'en' | 'zh_CN' | 'ar' | 'fr' | 'ru' | 'es';
export type ThemeSetting = 'light' | 'dark' | 'auto';

export interface BrowserChromeSpec {
  browserName: 'Safari' | 'Chrome';
  /** Top OS status bar height in CSS px (time, battery, signal) */
  topStatusBar: number;
  /** Top browser URL/toolbar height in CSS px */
  topUrlBar: number;
  /** Bottom navigation / home indicator bar height in CSS px */
  bottomBar: number;
}

export interface DeviceCutoutSpec {
  type: 'dynamic-island' | 'notch' | 'punch-hole' | 'tablet-bezel';
  width: number;
  height: number;
  topOffset: number;
  tabletCameraEdge?: 'portrait-top' | 'landscape-top';
}

export interface DeviceBezelSpec {
  bezelWidth: number;
  outerRadius: number;
  innerRadius: number;
  cutout: DeviceCutoutSpec;
}

export interface DeviceProfile {
  id: string;
  name: string;
  brand: string;
  category: DeviceCategory;
  os: DeviceOS;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  diagonalInches: number;
  ppi: number;
  /** Physical outer body width in mm (for flat-against-screen edge alignment) */
  bodyWidthMm: number;
  /** Physical outer body height in mm */
  bodyHeightMm: number;
  userAgent: string;
  secChUaPlatform: string;
  secChUaMobile: '?1' | '?0';
  secChUaModel: string;
  frameStyle: FrameStyle;
  bezel: DeviceBezelSpec;
  browserChrome: BrowserChromeSpec;
  isCustom?: boolean;
  noteEn?: string;
  noteZh?: string;
}

export interface CalibrationProfile {
  monitorKey: string;
  label: string;
  cssPxPerMm: number;
  method: CalibrationMethod;
  /** False when estimated from monitor diagonal preset; true after physical calibration */
  isCalibrated: boolean;
  updatedAt: number;
}

export interface UserSettings {
  language: LanguageSetting;
  theme: ThemeSetting;
  dismissedConflictNotice: boolean;
  dismissedPreviewHint?: boolean;
  hasSeenGuide?: boolean;
  defaultShowFrame: boolean;
  defaultShowBrowserBars: boolean;
  showSafeArea: boolean;
  defaultDeviceId: string;
}

export interface ScaleMetrics {
  scale: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
  desktopWidthPx: number;
  desktopHeightPx: number;
}

export interface DisplayPreset {
  id: string;
  diagonalInches: number;
  labelEn: string;
  labelZh: string;
}

export type RuntimeRequest =
  | {
      type: 'ACTIVATE_INPLACE';
      tabId: number;
      device: DeviceProfile;
      openCalibration?: boolean;
    }
  | {
      type: 'DEACTIVATE_INPLACE';
      tabId: number;
    }
  | {
      type: 'GET_TAB_INFO';
    }
  | {
      type: 'CAPTURE_VISIBLE_TAB';
      windowId: number;
    }
  | {
      type: 'APPLY_SIMULATOR_RULES';
      tabId: number;
      device: DeviceProfile;
    }
  | {
      type: 'CLEAR_SIMULATOR_RULES';
      tabId?: number;
    };

export type RuntimeResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
