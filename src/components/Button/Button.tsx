import type { FocusEventHandler, MouseEventHandler, PointerEventHandler, ReactNode } from 'react';
import styles from './Button.module.scss';

const VARIANTS = {
  primary: 'bg-brand color-brand-contrast border-color-brand',
  secondary: 'bg-surface color-text border-color-border',
  ghost: 'bg-transparent color-text border-color-transparent',
} as const;

/** Padding, gap and font size. `sm` has half the padding and gap of `lg`; `fs-small` is the only smaller font token. */
const SIZES = {
  sm: 'py-1 px-2 gap-1 fs-small',
  lg: 'py-2 px-3 gap-2 fs-body',
} as const;

type ButtonProps = {
  /** Native button type. Default: `button`. */
  type?: 'button' | 'submit' | 'reset';
  variant: keyof typeof VARIANTS;
  /** Padding, gap and font size. Default: `lg`. */
  size?: keyof typeof SIZES;
  /** Called on click. Optional: a `submit` button needs none. */
  action?: MouseEventHandler<HTMLButtonElement>;
  /** `id` of the `<form>` this button submits, when it is rendered outside of it. */
  form?: string;
  /** Accessible name, for buttons that have no text (icon only). */
  ariaLabel?: string;
  /** Called when the pointer enters (e.g. to prefetch what the click opens). */
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  /** Called when the button gets focus (keyboard counterpart of `onPointerEnter`). */
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  /** Text of the button. Ignored when `children` is given. */
  label?: string;
  children?: ReactNode;
  /** SVG shown before the text. */
  iconLeft?: ReactNode;
  /** SVG shown after the text. */
  iconRight?: ReactNode;
};

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'lg',
  action,
  form,
  ariaLabel,
  onPointerEnter,
  onFocus,
  label,
  children,
  iconLeft,
  iconRight,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles['button']} ${styles[variant]} inline-flex items-center justify-center border rounded-1 ${SIZES[size]} ${VARIANTS[variant]}`}
      form={form}
      aria-label={ariaLabel}
      onClick={action}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
    >
      {iconLeft && (
        <span className={`${styles['icon']} inline-flex shrink-0`} aria-hidden="true">
          {iconLeft}
        </span>
      )}
      {children ?? label}
      {iconRight && (
        <span className={`${styles['icon']} inline-flex shrink-0`} aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
