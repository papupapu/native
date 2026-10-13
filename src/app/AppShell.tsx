import { Link, Outlet } from 'react-router';
import styles from './AppShell.module.scss';
import './global.scss';
import { Footer } from './footer/Footer.tsx';
import { ModalProvider, useModal } from './modal/ModalProvider.tsx';

function LoginButton() {
  const modal = useModal();
  return (
    <button
      type="button"
      className={styles['login']}
      onClick={() => modal.open('login')}
      onPointerEnter={() => modal.prefetch('login')}
      onFocus={() => modal.prefetch('login')}
    >
      Accedi
    </button>
  );
}

export function AppShell() {
  return (
    <ModalProvider>
      <div className={styles['shell']}>
        <header className={styles['header']}>
          <Link to="/" className={styles['brand']}>
            casa PoC
          </Link>
          <nav className={styles['nav']}>
            <Link to="/">Home</Link>
            <Link to="/annunci/1">Annuncio</Link>
            <Link to="/annunci/404">Annuncio inesistente</Link>
            <Link to="/cerca?q=milano">Cerca</Link>
            <Link to="/cerca?q=zzz">Ricerca vuota (404)</Link>
            <Link to="/vecchia-url" reloadDocument>
              Vecchia URL (301)
            </Link>
            <LoginButton />
          </nav>
        </header>
        <main className={styles['main']}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </ModalProvider>
  );
}
