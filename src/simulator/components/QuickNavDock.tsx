import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpToLine, RefreshCw } from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';

interface QuickNavDockProps {
  isRtl: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  t: (k: TranslationKeys) => string;
}

const BTN_CLASS =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[#1D1D1F] transition hover:bg-[#F5F5F7] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E] dark:focus-visible:ring-[#0A84FF]';

export function QuickNavDock({
  isRtl,
  onBack,
  onForward,
  onReload,
  onScrollTop,
  onScrollBottom,
  t,
}: QuickNavDockProps) {
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <nav
      aria-label={t('quickNavLabel')}
      className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/[0.12] dark:bg-[#1C1C1E]/95"
    >
      <button
        type="button"
        onClick={onBack}
        title={t('navBack')}
        aria-label={t('navBack')}
        className={BTN_CLASS}
      >
        <BackIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onForward}
        title={t('navForward')}
        aria-label={t('navForward')}
        className={BTN_CLASS}
      >
        <ForwardIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onReload}
        title={t('reload')}
        aria-label={t('reload')}
        className={BTN_CLASS}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="my-0.5 h-px w-6 bg-black/10 dark:bg-white/[0.12]" />

      <button
        type="button"
        onClick={onScrollTop}
        title={t('scrollToTop')}
        aria-label={t('scrollToTop')}
        className={BTN_CLASS}
      >
        <ArrowUpToLine className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onScrollBottom}
        title={t('scrollToBottom')}
        aria-label={t('scrollToBottom')}
        className={BTN_CLASS}
      >
        <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
