import { Link } from 'react-router';
import styles from './FooterContent.module.scss';

// Grepped by `npm run check:bundle`: the footer must stay out of the initial chunks.
export const FOOTER_MARKER = '__FOOTER_CONTENT__';

const CITIES = ['Milano', 'Roma', 'Torino', 'Bergamo', 'Siena', 'Rimini'];

export function FooterContent() {
  return (
    <footer className={styles['footer']} data-footer={FOOTER_MARKER}>
      <div className={styles['columns']}>
        <section>
          <h2>Cerca casa</h2>
          <ul>
            {CITIES.map((city) => (
              <li key={city}>
                <Link to="/">Case in vendita a {city}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>casa PoC</h2>
          <ul>
            <li>
              <Link to="/">Chi siamo</Link>
            </li>
            <li>
              <Link to="/">Contatti</Link>
            </li>
            <li>
              <Link to="/">Privacy</Link>
            </li>
          </ul>
        </section>
      </div>
    </footer>
  );
}
