import { Form, Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import { selectSearch } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectSearch);
  if (!data) return null;

  return (
    <>
      <title>{`Cerca "${data.query}" | casa PoC`}</title>
      {data.total === 0 && <meta name="robots" content="noindex" />}
      <section className="py-4">
        <h1 className="m-0 mb-2 fs-title">Cerca casa</h1>
        <Form method="get" action="/cerca" className="flex gap-2" role="search">
          <input type="search" name="q" defaultValue={data.query} key={data.query} aria-label="Cerca" />
          <button type="submit">Cerca</button>
        </Form>
        <p className="color-text-muted">
          {data.total === 0 ? `Nessun risultato per "${data.query}"` : `${data.total} risultati per "${data.query}"`}
        </p>
      </section>
      <ul className="m-0 p-0 list-none">
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
