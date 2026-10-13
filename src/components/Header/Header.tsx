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
    <header className={styles['header']}>
      <Link to="/" className={styles['brand']}>
        {brand}
      </Link>
      <nav className={styles['nav']}>
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
