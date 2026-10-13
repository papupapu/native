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
      <section className={styles['hero']}>
        <h1>{data.headline}</h1>
        <p>Architettura SSR di portal18 sullo stack 2026: Express 5, React 19, React Router 8, Redux Toolkit.</p>
      </section>
      <ul className={styles['cards']}>
        {data.featured.map((listing) => (
          <li key={listing.id} className={styles['card']}>
            <h2>
              <Link to={`/annunci/${listing.id}`}>{listing.title}</Link>
            </h2>
            <p>
              {listing.city} · {listing.mq} mq · {listing.rooms} locali
            </p>
            <strong>{listing.price.toLocaleString('it-IT')} €</strong>
          </li>
        ))}
      </ul>
    </>
  );
}
