import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { buildCustomDeviceProfile } from '../../config/devices';
import type { TranslationKeys } from '../../shared/i18n';
import type { DeviceCategory, DeviceOS, DeviceProfile } from '../../shared/types';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface CustomDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (device: DeviceProfile) => Promise<void>;
  t: (k: TranslationKeys) => string;
}

export function CustomDeviceModal({ open, onClose, onSave, t }: CustomDeviceModalProps) {
  const [name, setName] = useState('Custom Phone');
  const [category, setCategory] = useState<DeviceCategory>('phone');
  const [os, setOs] = useState<DeviceOS>('ios');
  const [cssWidth, setCssWidth] = useState(390);
  const [cssHeight, setCssHeight] = useState(844);
  const [dpr, setDpr] = useState(3);
  const [diagonalInches, setDiagonalInches] = useState(6.1);

  const dialogRef = useRef<HTMLFormElement | null>(null);
  useModalFocusTrap(open, dialogRef, onClose);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || cssWidth <= 0 || cssHeight <= 0 || diagonalInches <= 0) return;
    const device = buildCustomDeviceProfile({
      name,
      category,
      os,
      cssWidth: Number(cssWidth),
      cssHeight: Number(cssHeight),
      dpr: Number(dpr) || 2,
      diagonalInches: Number(diagonalInches),
    });
    await onSave(device);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-custom-device-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md dark:bg-black/70"
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-5 text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="ts-custom-device-title" className="text-base font-semibold">
            {t('customDeviceTitle')}
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

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
              {t('deviceName')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('deviceCategory')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DeviceCategory)}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-2.5 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              >
                <option value="phone">{t('phone')}</option>
                <option value="tablet">{t('tablet')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('osLabel')}
              </label>
              <select
                value={os}
                onChange={(e) => setOs(e.target.value as DeviceOS)}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-2.5 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              >
                <option value="ios">iOS / iPadOS (Safari)</option>
                <option value="android">Android (Chrome)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('cssWidth')}
              </label>
              <input
                type="number"
                required
                min={240}
                max={1600}
                value={cssWidth}
                onChange={(e) => setCssWidth(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('cssHeight')}
              </label>
              <input
                type="number"
                required
                min={320}
                max={2000}
                value={cssHeight}
                onChange={(e) => setCssHeight(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('diagonalLabel')}
              </label>
              <input
                type="number"
                required
                min={3.5}
                max={18}
                step={0.1}
                value={diagonalInches}
                onChange={(e) => setDiagonalInches(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('dprLabel')}
              </label>
              <input
                type="number"
                required
                min={1}
                max={5}
                step={0.125}
                value={dpr}
                onChange={(e) => setDpr(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-[#F5F5F7] px-3 py-2 text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0066D6] dark:bg-[#0A84FF]"
          >
            {t('saveDevice')}
          </button>
        </div>
      </form>
    </div>
  );
}
