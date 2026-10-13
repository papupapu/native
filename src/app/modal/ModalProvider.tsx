import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { modalRegistry } from './registry.ts';
import type { ModalId, ModalProps } from './registry.ts';

interface ModalApi {
  open(id: ModalId): void;
  close(): void;
  /** Starts downloading the modal chunk (pointer hover / keyboard focus on the trigger). */
  prefetch(id: ModalId): void;
}

const ModalContext = createContext<ModalApi | null>(null);

const lazyModals = new Map<ModalId, LazyExoticComponent<ComponentType<ModalProps>>>();
function getLazyModal(id: ModalId) {
  let component = lazyModals.get(id);
  if (!component) {
    component = lazy(modalRegistry[id]);
    lazyModals.set(id, component);
  }
  return component;
}

/**
 * Renders nothing, and imports nothing, until `open(id)` is called: the modal chunk is requested
 * by the click (or by `prefetch` on hover). The portal only exists on the client, after a click,
 * so it never takes part in hydration.
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<ModalId | null>(null);
  const close = useCallback(() => setOpenId(null), []);
  const api = useMemo<ModalApi>(
    () => ({
      open: setOpenId,
      close,
      prefetch: (id) => void modalRegistry[id](),
    }),
    [close],
  );

  const Modal = openId ? getLazyModal(openId) : null;

  return (
    <ModalContext value={api}>
      {children}
      {Modal &&
        createPortal(
          <Suspense fallback={null}>
            <Modal onClose={close} />
          </Suspense>,
          document.body,
        )}
    </ModalContext>
  );
}

export function useModal(): ModalApi {
  const api = useContext(ModalContext);
  if (!api) throw new Error('useModal must be used inside <ModalProvider>');
  return api;
}
