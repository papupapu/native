import { Link } from 'react-router';

export type FooterLink = { to: string; label: string };
export type FooterSection = { title: string; links: FooterLink[] };

type FooterProps = { sections: FooterSection[] };

export function Footer({ sections }: FooterProps) {
  return (
    <footer className="mt-5 py-4 px-3 border-t bg-surface">
      <div className="flex flex-wrap gap-5 max-w-page mx-auto">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="m-0 mb-2 fs-body">{section.title}</h2>
            <ul className="list-none m-0 p-0 fs-small">
              {section.links.map((link) => (
                <li key={link.label} className="mb-1">
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
