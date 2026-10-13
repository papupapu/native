import { useEffect } from 'react';
import styles from './LoginModal.module.scss';
import type { ModalProps } from './registry.ts';

// Grepped by `npm run check:bundle`: must never appear in a chunk that loads with the page.
export const MODAL_MARKER = '__MODAL_LOGIN__';

export default function LoginModal({ onClose }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={`${styles['overlay']} flex items-center justify-center`} onClick={onClose} data-modal={MODAL_MARKER}>
      <div
        className={`${styles['dialog']} p-4 rounded-2 bg-surface`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="m-0 mb-3" id="login-title">Accedi</h2>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className="block mb-3 fs-small">
            Email
            <input className="block w-full mt-1 p-2 border rounded-1" type="email" name="email" autoComplete="username" autoFocus />
          </label>
          <label className="block mb-3 fs-small">
            Password
            <input className="block w-full mt-1 p-2 border rounded-1" type="password" name="password" autoComplete="current-password" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}>
              Annulla
            </button>
            <button type="submit">Accedi</button>
          </div>
        </form>
      </div>
    </div>
  );
}
