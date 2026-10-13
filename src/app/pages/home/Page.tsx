import { Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import styles from './Page.module.scss';
import { selectHome } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectHome);
  if (!data) return null;

  return (
    <>
      <title>Home | casa PoC</title>
      <meta name="description" content={data.headline} />
      <section className="pt-5 pb-4">
        <h1 className="m-0 mb-2 fs-title">{data.headline}</h1>
        <p className="m-0 color-text-muted">Architettura SSR di portal18 sullo stack 2026: Express 5, React 19, React Router 8, Redux Toolkit.</p>
      </section>
      <ul className={`${styles['cards']} grid gap-3 m-0 p-0 list-none`}>
        {data.featured.map((listing) => (
          <li key={listing.id} className="p-3 border rounded-2 bg-surface">
            <h2 className={`${styles['cardTitle']} m-0 mb-2`}>
              <Link to={`/annunci/${listing.id}`}>{listing.title}</Link>
            </h2>
            <p className="m-0 mb-2 color-text-muted fs-small">
              {listing.city} · {listing.mq} mq · {listing.rooms} locali
            </p>
            <strong>{listing.price.toLocaleString('it-IT')} €</strong>
          </li>
        ))}
      </ul>
    </>
  );
}
