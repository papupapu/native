import type { ComponentType } from 'react';

/** Passed by `ModalProvider` to every modal; a modal forwards it to the `Modal` shell as is. */
export interface ModalProps {
  /** Starts the (animated) close. */
  onClose: () => void;
  /** True from `onClose` until the exit animation is over: the shell plays the exit. */
  closing: boolean;
  /** Called by the shell once the dialog is closed: the provider unmounts the modal. */
  onExited: () => void;
}

/**
 * Explicit registry: every entry is a literal `import()` with its own chunk name, so webpack
 * emits one `modal-*` chunk per modal and nothing from them reaches the initial bundle.
 * Never build the specifier dynamically (`import(`./${id}`)` would bundle every file in the folder).
 */
export const modalRegistry = {
  login: () => import(/* webpackChunkName: "modal-login" */ './LoginModal.tsx'),
} satisfies Record<string, () => Promise<{ default: ComponentType<ModalProps> }>>;

export type ModalId = keyof typeof modalRegistry;
