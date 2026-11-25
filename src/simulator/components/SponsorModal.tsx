import { useRef } from 'react';
import { Coffee, ExternalLink, Heart, X } from 'lucide-react';
import { SPONSOR_CONFIG } from '../../config/sponsor';
import type { TranslationKeys } from '../../shared/i18n';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface SponsorModalProps {
  open: boolean;
  onClose: () => void;
  t: (k: TranslationKeys) => string;
}

export function SponsorModal({ open, onClose, t }: SponsorModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useModalFocusTrap(open && SPONSOR_CONFIG.enabled, dialogRef, onClose);

  if (!open || !SPONSOR_CONFIG.enabled) return null;

  const hasAnyUrl = Boolean(
    SPONSOR_CONFIG.buyMeACoffeeUrl ||
      SPONSOR_CONFIG.kofiUrl ||
      SPONSOR_CONFIG.afdianUrl ||
      SPONSOR_CONFIG.wechatQrPath ||
      SPONSOR_CONFIG.alipayQrPath,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-sponsor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md dark:bg-black/70"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-5 text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-[#FF9500]" aria-hidden="true" />
            <h2 id="ts-sponsor-title" className="text-base font-semibold">
              {t('sponsorTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="cursor-pointer rounded-full bg-black/[0.05] p-1.5 text-[#6E6E73] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:bg-white/10 dark:text-[#98989D]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
          {t('sponsorSubtitle')}
        </p>

        {!hasAnyUrl ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-[#F5F5F7] p-4 text-center text-xs text-[#6E6E73] dark:border-white/[0.15] dark:bg-[#2C2C2E] dark:text-[#98989D]">
            <Heart className="mx-auto mb-2 h-5 w-5 text-rose-500" aria-hidden="true" />
            <p>{t('sponsorNotConfigured')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              {SPONSOR_CONFIG.buyMeACoffeeUrl && (
                <a
                  href={SPONSOR_CONFIG.buyMeACoffeeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl bg-amber-400 px-3.5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
                >
                  <span>{t('sponsorBuyMeACoffee')}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              {SPONSOR_CONFIG.kofiUrl && (
                <a
                  href={SPONSOR_CONFIG.kofiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl bg-[#007AFF] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0066D6]"
                >
                  <span>{t('sponsorKofi')}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              {SPONSOR_CONFIG.afdianUrl && (
                <a
                  href={SPONSOR_CONFIG.afdianUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400"
                >
                  <span>{t('sponsorAfdian')}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>

            {(SPONSOR_CONFIG.wechatQrPath || SPONSOR_CONFIG.alipayQrPath) && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {SPONSOR_CONFIG.wechatQrPath && (
                  <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2 text-center dark:border-white/[0.12] dark:bg-[#2C2C2E]">
                    <img
                      src={SPONSOR_CONFIG.wechatQrPath}
                      alt={t('sponsorWechat')}
                      className="mx-auto mb-1.5 h-32 w-32 rounded-lg object-contain"
                    />
                    <span className="text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">
                      {t('sponsorWechat')}
                    </span>
                  </div>
                )}
                {SPONSOR_CONFIG.alipayQrPath && (
                  <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F7] p-2 text-center dark:border-white/[0.12] dark:bg-[#2C2C2E]">
                    <img
                      src={SPONSOR_CONFIG.alipayQrPath}
                      alt={t('sponsorAlipay')}
                      className="mx-auto mb-1.5 h-32 w-32 rounded-lg object-contain"
                    />
                    <span className="text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">
                      {t('sponsorAlipay')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
