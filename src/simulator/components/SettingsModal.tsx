import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';
import type { DeviceProfile, LanguageSetting, ThemeSetting, UserSettings } from '../../shared/types';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onResetCalibration: () => Promise<void>;
  onResetPlugin: () => Promise<void>;
  customDevices: DeviceProfile[];
  onDeleteCustomDevice: (deviceId: string) => Promise<void>;
  t: (k: TranslationKeys) => string;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onResetCalibration,
  onResetPlugin,
  customDevices,
  onDeleteCustomDevice,
  t,
}: SettingsModalProps) {
  const [confirmResetPlugin, setConfirmResetPlugin] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useModalFocusTrap(open, dialogRef, onClose);

  useEffect(() => {
    if (!open) setConfirmResetPlugin(false);
  }, [open]);

  const appVersion = useMemo(() => {
    const manifest =
      typeof chrome !== 'undefined' && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest()
        : null;
    return manifest?.version_name || manifest?.version || '1.0.1';
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-md dark:bg-black/70"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="my-auto w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-5 text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="ts-settings-title" className="text-base font-semibold">
            {t('settingsTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="cursor-pointer rounded-full bg-black/[0.05] p-1.5 text-[#6E6E73] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:bg-white/10 dark:text-[#98989D]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="mb-1.5 block font-medium text-[#6E6E73] dark:text-[#98989D]">
              {t('themeLabel')}
            </label>
            <div
              role="radiogroup"
              aria-label={t('themeLabel')}
              className="grid grid-cols-3 rounded-xl bg-[#E5E5EA]/70 p-1 dark:bg-[#2C2C2E]"
            >
              {(
                [
                  { id: 'light', label: t('themeLight') },
                  { id: 'dark', label: t('themeDark') },
                  { id: 'auto', label: t('themeAuto') },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === item.id}
                  onClick={() => void onUpdateSettings({ theme: item.id as ThemeSetting })}
                  className={`cursor-pointer rounded-lg px-2 py-1.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
                    settings.theme === item.id
                      ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#0A84FF] dark:text-white'
                      : 'text-[#6E6E73] dark:text-[#98989D]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="ts-settings-lang"
              className="mb-1.5 block font-medium text-[#6E6E73] dark:text-[#98989D]"
            >
              {t('languageLabel')}
            </label>
            <select
              id="ts-settings-lang"
              value={settings.language}
              onChange={(e) =>
                void onUpdateSettings({ language: e.target.value as LanguageSetting })
              }
              className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
            >
              <option value="auto">{t('langAuto')}</option>
              <option value="zh_CN">{t('langZh')}</option>
              <option value="en">{t('langEn')}</option>
              <option value="ar">{t('langAr')}</option>
              <option value="fr">{t('langFr')}</option>
              <option value="ru">{t('langRu')}</option>
              <option value="es">{t('langEs')}</option>
            </select>
          </div>

          {customDevices.length > 0 && (
            <div>
              <div className="mb-1.5 font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('customGroup')}
              </div>
              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {customDevices.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3 py-1.5 dark:border-white/[0.1] dark:bg-[#2C2C2E]"
                  >
                    <span>
                      {d.name} ({d.cssWidth}×{d.cssHeight}, {d.diagonalInches}&quot;)
                    </span>
                    <button
                      type="button"
                      onClick={() => void onDeleteCustomDevice(d.id)}
                      aria-label={t('deleteProfile')}
                      className="cursor-pointer text-[#86868B] hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onResetCalibration()}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/12 px-3 py-2 font-medium text-[#B25000] transition hover:bg-[#FF9500]/20 dark:text-[#FF9F0A]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('resetCalibrationBtn')}</span>
            </button>

            {!confirmResetPlugin ? (
              <button
                type="button"
                onClick={() => setConfirmResetPlugin(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-medium text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('resetPluginBtn')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmResetPlugin(false);
                    void onResetPlugin();
                  }}
                  className="cursor-pointer rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  {t('resetPluginConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetPlugin(false)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989D]"
                >
                  {t('cancel')}
                </button>
              </div>
            )}

            {(settings.dismissedConflictNotice || settings.dismissedPreviewHint) && (
              <button
                type="button"
                onClick={() =>
                  void onUpdateSettings({
                    dismissedConflictNotice: false,
                    dismissedPreviewHint: false,
                  })
                }
                className="cursor-pointer rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 font-medium text-[#1D1D1F] hover:bg-slate-200 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              >
                {t('showConflictNoticeAgain')}
              </button>
            )}
          </div>

          {/* About & Persistence Card */}
          <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-3.5 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              <Info className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
              <span>{t('aboutTitle')}</span>
            </div>
            <div className="space-y-1.5 text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73] dark:text-[#98989D]">{t('aboutVersionLabel')}</span>
                <span
                  dir="ltr"
                  className="rounded-full bg-[#007AFF]/12 px-2 py-0.5 font-mono font-medium text-[#0066D6] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]"
                >
                  v{appVersion}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E73] dark:text-[#98989D]">{t('aboutAuthorLabel')}</span>
                <span>{t('aboutAuthorValue')}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-[#6E6E73] dark:text-[#98989D]">
                  {t('aboutTechLabel')}
                </span>
                <span dir="ltr" className="text-end">
                  {t('aboutTechValue')}
                </span>
              </div>
              <div className="border-t border-black/[0.06] pt-1.5 text-[#6E6E73] dark:border-white/[0.08] dark:text-[#98989D]">
                <strong className="text-[#3A3A3C] dark:text-[#E5E5EA]">
                  {t('aboutStorageLabel')}:{' '}
                </strong>
                {t('aboutStorageValue')}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#34C759]/25 bg-[#34C759]/10 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#248A3D] dark:text-[#30D158]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{t('privacyTitle')}</span>
            </div>
            <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
              {t('privacyText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
