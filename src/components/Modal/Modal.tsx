import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import styles from './Modal.module.scss';
import { Button } from '../Button/Button.tsx';
import type { ModalProps } from '../../app/modal/registry.ts';

type ModalShellProps = ModalProps & {
  /** Width: 400 / 560 / 800px (always capped to the viewport). Height follows the content. Default: `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Below the `md` breakpoint: `fullscreen` fills the viewport, `dialog` stays a centered box. Default: `fullscreen`. */
  mobile?: 'fullscreen' | 'dialog';
  /** Standard action bar. No footer when omitted. */
  footer?: ReactNode;
  /** Close (X) button: in the header, or floating in the corner when there is no header. Default: `true`. */
  closeButton?: boolean;
  children: ReactNode;
} & (
  // `title` renders the standard header and names the dialog; without it `ariaLabel` is required.
  { title: ReactNode; ariaLabel?: never } | { title?: never; ariaLabel: string }
);

const CloseIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);

/**
 * Standard shell of every modal: native `<dialog>` (top layer, focus trap, inert page behind it),
 * optional header and footer, enter and exit animations. A modal renders its content inside it.
 * Only the modal chunks import it, so it never reaches main/vendor/route.
 *
 * Lifecycle: the dialog opens on mount; `closing` (set by the provider through `onClose`) plays the
 * exit animation, then `dialog.close()`; its `close` event calls `onExited` and the provider unmounts.
 */
export function Modal({
  size = 'md',
  mobile = 'fullscreen',
  title,
  ariaLabel,
  footer,
  closeButton = true,
  closing,
  onClose,
  onExited,
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Strict Mode mounts twice on the same node: `showModal()` throws when already open.
    if (!dialog.open) dialog.showModal();
    // `showModal()` focuses the first focusable element (the close button): move it to the content's pick.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `open()` while the exit is playing flips `closing` back: the cleanup cancels the pending close.
    let cancelled = false;
    // Includes `::backdrop`. Nothing is running with `prefers-reduced-motion`: it closes right away.
    const running = dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined));
    void Promise.all(running).then(() => {
      if (!cancelled && dialog.open) dialog.close();
    });
    return () => {
      cancelled = true;
    };
  }, [closing]);

  // Only the backdrop (a click on the dialog itself, outside its box) closes.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) onClose();
  };

  const close = closeButton && <Button variant="ghost" size="sm" ariaLabel="Chiudi" iconLeft={CloseIcon} action={onClose} />;

  return (
    <dialog
      ref={dialogRef}
      className={`${styles['dialog']} bg-surface color-text`}
      data-size={size}
      data-mobile={mobile}
      data-state={closing ? 'closing' : 'open'}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      onCancel={(event) => {
        // Escape: the native close would skip the exit animation.
        event.preventDefault();
        onClose();
      }}
      onClose={onExited}
      onClick={onDialogClick}
    >
      {title ? (
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <h2 className="m-0 fs-body" id={titleId}>
            {title}
          </h2>
          {close}
        </header>
      ) : (
        close && <div className={styles['floating-close']}>{close}</div>
      )}
      <div className={`${styles['body']} flex-1 p-4`}>{children}</div>
      {footer && <footer className="flex justify-end gap-2 px-4 py-3 border-t">{footer}</footer>}
    </dialog>
  );
}
