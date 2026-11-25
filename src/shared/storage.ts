import { DEFAULT_DEVICE_ID } from '../config/devices';
import type { CalibrationProfile, DeviceProfile, UserSettings } from './types';

const KEYS = {
  SETTINGS: 'ts_settings_v1',
  CALIBRATIONS: 'ts_calibrations_v1',
  CUSTOM_DEVICES: 'ts_custom_devices_v1',
} as const;

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'auto',
  theme: 'light',
  dismissedConflictNotice: false,
  dismissedPreviewHint: false,
  hasSeenGuide: false,
  defaultShowFrame: true,
  defaultShowBrowserBars: true,
  showSafeArea: false,
  defaultDeviceId: DEFAULT_DEVICE_ID,
};

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function getSettings(): Promise<UserSettings> {
  if (!hasChromeStorage()) {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  }
  const result = await chrome.storage.local.get(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] ?? {}) };
}

export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  if (!hasChromeStorage()) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(next));
    return next;
  }
  await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
  return next;
}

export async function getCalibrationProfiles(): Promise<Record<string, CalibrationProfile>> {
  if (!hasChromeStorage()) {
    const raw = localStorage.getItem(KEYS.CALIBRATIONS);
    return raw ? JSON.parse(raw) : {};
  }
  const result = await chrome.storage.local.get(KEYS.CALIBRATIONS);
  return result[KEYS.CALIBRATIONS] ?? {};
}

export async function saveCalibrationProfile(
  profile: CalibrationProfile,
): Promise<Record<string, CalibrationProfile>> {
  const all = await getCalibrationProfiles();
  const next = { ...all, [profile.monitorKey]: profile };
  if (!hasChromeStorage()) {
    localStorage.setItem(KEYS.CALIBRATIONS, JSON.stringify(next));
    return next;
  }
  await chrome.storage.local.set({ [KEYS.CALIBRATIONS]: next });
  return next;
}

export async function deleteCalibrationProfile(
  monitorKey: string,
): Promise<Record<string, CalibrationProfile>> {
  const all = await getCalibrationProfiles();
  const next = { ...all };
  delete next[monitorKey];
  if (!hasChromeStorage()) {
    localStorage.setItem(KEYS.CALIBRATIONS, JSON.stringify(next));
    return next;
  }
  await chrome.storage.local.set({ [KEYS.CALIBRATIONS]: next });
  return next;
}

export async function clearCalibrationProfiles(): Promise<Record<string, CalibrationProfile>> {
  if (!hasChromeStorage()) {
    localStorage.removeItem(KEYS.CALIBRATIONS);
    return {};
  }
  await chrome.storage.local.set({ [KEYS.CALIBRATIONS]: {} });
  return {};
}

export async function resetAllPluginData(): Promise<void> {
  if (!hasChromeStorage()) {
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.CALIBRATIONS);
    localStorage.removeItem(KEYS.CUSTOM_DEVICES);
    return;
  }
  await chrome.storage.local.remove([KEYS.SETTINGS, KEYS.CALIBRATIONS, KEYS.CUSTOM_DEVICES]);
}

export async function getCustomDevices(): Promise<DeviceProfile[]> {
  if (!hasChromeStorage()) {
    const raw = localStorage.getItem(KEYS.CUSTOM_DEVICES);
    return raw ? JSON.parse(raw) : [];
  }
  const result = await chrome.storage.local.get(KEYS.CUSTOM_DEVICES);
  return Array.isArray(result[KEYS.CUSTOM_DEVICES]) ? result[KEYS.CUSTOM_DEVICES] : [];
}

export async function saveCustomDevice(device: DeviceProfile): Promise<DeviceProfile[]> {
  const existing = await getCustomDevices();
  const filtered = existing.filter((d) => d.id !== device.id);
  const next = [...filtered, device];
  if (!hasChromeStorage()) {
    localStorage.setItem(KEYS.CUSTOM_DEVICES, JSON.stringify(next));
    return next;
  }
  await chrome.storage.local.set({ [KEYS.CUSTOM_DEVICES]: next });
  return next;
}

export async function deleteCustomDevice(deviceId: string): Promise<DeviceProfile[]> {
  const existing = await getCustomDevices();
  const next = existing.filter((d) => d.id !== deviceId);
  if (!hasChromeStorage()) {
    localStorage.setItem(KEYS.CUSTOM_DEVICES, JSON.stringify(next));
    return next;
  }
  await chrome.storage.local.set({ [KEYS.CUSTOM_DEVICES]: next });
  return next;
}
