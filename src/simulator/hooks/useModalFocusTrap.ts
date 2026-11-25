import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps Tab focus within an open modal inside either standard DOM or Shadow DOM,
 * handles Escape dismissal, and restores focus to the opener element on close.
 */
export function useModalFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const rootNode = container.getRootNode() as Document | ShadowRoot;
    const previousFocus =
      (rootNode && 'activeElement' in rootNode ? rootNode.activeElement : document.activeElement) as
        | HTMLElement
        | null;

    const focusTimer = window.setTimeout(() => {
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const currentActive =
        rootNode && 'activeElement' in rootNode ? rootNode.activeElement : document.activeElement;

      if (e.shiftKey) {
        if (currentActive === first || !container.contains(currentActive as Node | null)) {
          e.preventDefault();
          last.focus();
        }
      } else if (currentActive === last || !container.contains(currentActive as Node | null)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown, true);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [open, containerRef, onClose]);
}
