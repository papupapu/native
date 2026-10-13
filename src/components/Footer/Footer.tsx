import { Link } from 'react-router';
import styles from './Footer.module.scss';

export type FooterLink = { to: string; label: string };
export type FooterSection = { title: string; links: FooterLink[] };

type FooterProps = { sections: FooterSection[] };

export function Footer({ sections }: FooterProps) {
  return (
    <footer className={styles['footer']}>
      <div className={styles['columns']}>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </footer>
  );
}
