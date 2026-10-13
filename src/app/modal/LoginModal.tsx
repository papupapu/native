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
    <div className={styles['overlay']} onClick={onClose} data-modal={MODAL_MARKER}>
      <div
        className={styles['dialog']}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="login-title">Accedi</h2>
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" autoFocus />
          </label>
          <label>
            Password
            <input type="password" name="password" autoComplete="current-password" />
          </label>
          <div className={styles['actions']}>
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
