import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Header.module.scss';

export type HeaderLink = { to: string; label: string; reloadDocument?: boolean };

type HeaderProps = {
  brand: string;
  links: HeaderLink[];
  /** Rendered after the links (buttons, user menu...). */
  actions?: ReactNode;
};

export function Header({ brand, links, actions }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 p-3 border-b bg-surface">
      <Link to="/" className={`${styles['brand']} color-brand fw-bold no-underline`}>
        {brand}
      </Link>
      <nav className="flex flex-wrap gap-3 fs-small">
        {links.map((link) => (
          <Link key={link.to} to={link.to} reloadDocument={link.reloadDocument}>
            {link.label}
          </Link>
        ))}
        {actions}
      </nav>
    </header>
  );
}
