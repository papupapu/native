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
      <article className={styles['listing']}>
        <p>
          <Link to="/">← Home</Link>
        </p>
        <h1>{data.title}</h1>
        <p className={styles['meta']}>
          {data.city} · {data.mq} mq · {data.rooms} locali
        </p>
        <p>{data.description}</p>
        <strong className={styles['price']}>{data.price.toLocaleString('it-IT')} €</strong>
      </article>
    </>
  );
}
