import type { ComponentType } from 'react';

export interface ModalProps {
  onClose: () => void;
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
