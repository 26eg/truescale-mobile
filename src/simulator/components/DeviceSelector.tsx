import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';
import type { DeviceProfile } from '../../shared/types';

interface DeviceSelectorProps {
  devices: DeviceProfile[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onOpenCustomDevice: () => void;
  t: (k: TranslationKeys) => string;
}

interface SelectableEntry {
  id: string;
  label: string;
  group: 'phone' | 'tablet' | 'custom' | 'action';
}

export function DeviceSelector({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onOpenCustomDevice,
  t,
}: DeviceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const phones = useMemo(
    () => devices.filter((d) => d.category === 'phone' && !d.isCustom),
    [devices],
  );
  const tablets = useMemo(
    () => devices.filter((d) => d.category === 'tablet' && !d.isCustom),
    [devices],
  );
  const custom = useMemo(() => devices.filter((d) => d.isCustom), [devices]);

  const flatEntries = useMemo<SelectableEntry[]>(() => {
    const list: SelectableEntry[] = [];
    for (const d of phones) {
      list.push({ id: d.id, label: `${d.name} (${d.diagonalInches}")`, group: 'phone' });
    }
    for (const d of tablets) {
      list.push({ id: d.id, label: `${d.name} (${d.diagonalInches}")`, group: 'tablet' });
    }
    for (const d of custom) {
      list.push({ id: d.id, label: `${d.name} (${d.diagonalInches}")`, group: 'custom' });
    }
    list.push({ id: '__add_custom__', label: t('addCustomDevice'), group: 'action' });
    return list;
  }, [phones, tablets, custom, t]);

  const activeDevice = devices.find((d) => d.id === selectedDeviceId) ?? devices[0];

  useEffect(() => {
    if (!open) return;
    const idx = flatEntries.findIndex((entry) => entry.id === selectedDeviceId);
    setHighlightedIdx(idx >= 0 ? idx : 0);
  }, [open, flatEntries, selectedDeviceId]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIdx]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      const path = e.composedPath();
      if (containerRef.current && !path.includes(containerRef.current)) {
        setOpen(false);
      }
    };
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onWinKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onWinKeyDown, true);
    };
  }, [open]);

  const commitEntry = (entry: SelectableEntry) => {
    setOpen(false);
    if (entry.id === '__add_custom__') {
      onOpenCustomDevice();
    } else {
      onSelectDevice(entry.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % flatEntries.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + flatEntries.length) % flatEntries.length);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIdx(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIdx(flatEntries.length - 1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = flatEntries[highlightedIdx];
      if (target) commitEntry(target);
    }
  };

  const renderGroup = (
    title: string,
    items: DeviceProfile[],
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-1 last:mb-0">
        <div className="px-2.5 py-1 text-xs font-semibold tracking-wide text-[#86868B] dark:text-[#8E8E93]">
          {title}
        </div>
        {items.map((d) => {
          const idx = flatEntries.findIndex((entry) => entry.id === d.id);
          const isSelected = d.id === selectedDeviceId;
          const isHighlighted = idx === highlightedIdx;
          return (
            <button
              key={d.id}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setHighlightedIdx(idx)}
              onClick={() => commitEntry(flatEntries[idx])}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-start text-xs transition ${
                isSelected
                  ? 'bg-[#007AFF] font-semibold text-white'
                  : isHighlighted
                    ? 'bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                    : 'text-[#1D1D1F] hover:bg-[#F5F5F7] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              <span dir="ltr" className="truncate">
                {d.name} ({d.diagonalInches}&quot;)
              </span>
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    );
  };

  const addCustomIdx = flatEntries.length - 1;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="ts-device-listbox"
        aria-label={t('selectDevice')}
        onClick={() => setOpen((prev) => !prev)}
        className="flex max-w-[230px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] shadow-2xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:focus-visible:ring-[#0A84FF]"
      >
        <span dir="ltr" className="truncate">
          {activeDevice.name} ({activeDevice.diagonalInches}&quot;)
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#6E6E73] transition-transform dark:text-[#98989D] ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="ts-device-listbox"
          role="listbox"
          aria-label={t('selectDevice')}
          className="absolute start-0 top-full z-[70] mt-1.5 max-h-[65vh] w-64 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1.5 text-[#1D1D1F] shadow-2xl dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
        >
          {renderGroup(t('phonesGroup'), phones)}
          {renderGroup(t('tabletsGroup'), tablets)}
          {renderGroup(t('customGroup'), custom)}

          <div className="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/[0.08]">
            <button
              ref={(el) => {
                optionRefs.current[addCustomIdx] = el;
              }}
              type="button"
              role="option"
              aria-selected={false}
              onMouseEnter={() => setHighlightedIdx(addCustomIdx)}
              onClick={() => commitEntry(flatEntries[addCustomIdx])}
              className={`flex w-full cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-start text-xs font-medium text-[#007AFF] transition dark:text-[#64D2FF] ${
                highlightedIdx === addCustomIdx
                  ? 'bg-[#007AFF]/10'
                  : 'hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t('addCustomDevice').replace(/^\+\s*/, '')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
