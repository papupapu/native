import { useId } from 'react';
import type { ModalProps } from './registry.ts';

import { Button } from '../../components/Button/Button.tsx';
import { Modal } from '../../components/Modal/Modal.tsx';

// Grepped by `npm run check:bundle`: must never appear in a chunk that loads with the page.
export const MODAL_MARKER = '__MODAL_LOGIN__';

export default function LoginModal(props: ModalProps) {
  const formId = useId();

  return (
    <Modal
      {...props}
      size="sm"
      title="Accedi"
      footer={
        <>
          <Button variant="ghost" size="sm" action={props.onClose} label="Annulla" />
          {/* Outside the <form>, so it points at it by id. */}
          <Button type="submit" form={formId} variant="primary" size="sm" label="Accedi" />
        </>
      }
    >
      <form id={formId} onSubmit={(event) => event.preventDefault()} data-modal={MODAL_MARKER}>
        <label className="block mb-3 fs-small">
          Email
          <input className="block w-full mt-1 p-2 border rounded-1" type="email" name="email" autoComplete="username" data-autofocus />
        </label>
        <label className="block fs-small">
          Password
          <input className="block w-full mt-1 p-2 border rounded-1" type="password" name="password" autoComplete="current-password" />
        </label>
      </form>
    </Modal>
  );
}
