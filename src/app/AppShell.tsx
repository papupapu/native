import { Outlet } from 'react-router';
import styles from './AppShell.module.scss';
import './global.scss';
import '../styles/utilities.scss';
import { Button } from '../components/Button/Button.tsx';
import { Footer } from '../components/Footer/Footer.tsx';
import type { FooterSection } from '../components/Footer/Footer.tsx';
import { Header } from '../components/Header/Header.tsx';
import type { HeaderLink } from '../components/Header/Header.tsx';
import { ModalProvider, useModal } from './modal/ModalProvider.tsx';

const HEADER_LINKS: HeaderLink[] = [
  { to: '/', label: 'Home' },
  { to: '/annunci/1', label: 'Annuncio' },
  { to: '/annunci/404', label: 'Annuncio inesistente' },
  { to: '/cerca?q=milano', label: 'Cerca' },
  { to: '/cerca?q=zzz', label: 'Ricerca vuota (404)' },
  { to: '/vecchia-url', label: 'Vecchia URL (301)', reloadDocument: true },
];

const CITIES = ['Milano', 'Roma', 'Torino', 'Bergamo', 'Siena', 'Rimini'];

const FOOTER_SECTIONS: FooterSection[] = [
  { title: 'Cerca casa', links: CITIES.map((city) => ({ to: '/', label: `Case in vendita a ${city}` })) },
  {
    title: 'casa PoC',
    links: [
      { to: '/', label: 'Chi siamo' },
      { to: '/', label: 'Contatti' },
      { to: '/', label: 'Privacy' },
    ],
  },
];

function LoginButton() {
  const modal = useModal();
  return (
    <Button
      variant="primary"
      label="Accedi"
      action={() => modal.open('login')}
      onPointerEnter={() => modal.prefetch('login')}
      onFocus={() => modal.prefetch('login')}
    />
  );
}

export function AppShell() {
  return (
    <ModalProvider>
      <div className={`${styles['shell']} flex flex-col`}>
        <Header brand="casa PoC" links={HEADER_LINKS} actions={<LoginButton />} />
        <main className="flex-1 w-full max-w-page mx-auto px-3">
          <Outlet />
        </main>
        <Footer sections={FOOTER_SECTIONS} />
      </div>
    </ModalProvider>
  );
}
