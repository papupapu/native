import { Form, Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import styles from './Page.module.scss';
import { selectSearch } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectSearch);
  if (!data) return null;

  return (
    <>
      <title>{`Cerca "${data.query}" | casa PoC`}</title>
      {data.total === 0 && <meta name="robots" content="noindex" />}
      <section className={styles['search']}>
        <h1>Cerca casa</h1>
        <Form method="get" action="/cerca" className={styles['form']} role="search">
          <input type="search" name="q" defaultValue={data.query} key={data.query} aria-label="Cerca" />
          <button type="submit">Cerca</button>
        </Form>
        <p className={styles['count']}>
          {data.total === 0 ? `Nessun risultato per "${data.query}"` : `${data.total} risultati per "${data.query}"`}
        </p>
      </section>
      <ul className={styles['results']}>
        {data.results.map((listing) => (
          <li key={listing.id}>
            <Link to={`/annunci/${listing.id}`}>{listing.title}</Link> · {listing.city} ·{' '}
            {listing.price.toLocaleString('it-IT')} €
          </li>
        ))}
      </ul>
    </>
  );
}
