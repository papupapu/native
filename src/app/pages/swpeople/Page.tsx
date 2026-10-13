import { Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import styles from './Page.module.scss';
import { selectSwPeople } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectSwPeople);
  if (!data) return null;

  return (
    <>
      <title>{`${data.name} | casa PoC`}</title>
      <meta name="description" content={data.name} />
      <article className={styles['listing']}>
        <p>
          <Link to="/">← Home</Link>
        </p>
        <h1>{data.name}</h1>
        <p className={styles['meta']}>
          hair: {data.hair_color} · {data.mass} kg · {data.height} cm
        </p>
        <p>{data.name}</p>        
      </article>
    </>
  );
}
