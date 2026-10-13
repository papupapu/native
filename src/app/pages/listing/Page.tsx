import { Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import styles from './Page.module.scss';
import { selectListing } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectListing);
  if (!data) return null;

  return (
    <>
      <title>{`${data.title} | casa PoC`}</title>
      <meta name="description" content={data.description} />
      <article className="py-4">
        <p>
          <Link to="/">← Home</Link>
        </p>
        <h1 className="m-0 mb-2 fs-title">{data.title}</h1>
        <p className="color-text-muted">
          {data.city} · {data.mq} mq · {data.rooms} locali
        </p>
        <p>{data.description}</p>
        <strong className={`${styles['price']} block mt-3 color-brand`}>{data.price.toLocaleString('it-IT')} €</strong>
      </article>
    </>
  );
}
