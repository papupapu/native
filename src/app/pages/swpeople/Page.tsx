import { Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import { selectSwPeople } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectSwPeople);
  if (!data) return null;

  return (
    <>
      <title>{`${data.name} | casa PoC`}</title>
      <meta name="description" content={data.name} />
      <article className="py-4">
        <p>
          <Link to="/">← Home</Link>
        </p>
        <h1 className="m-0 mb-2 fs-title">{data.name}</h1>
        <p className="color-text-muted">
          hair: {data.hair_color} · {data.mass} kg · {data.height} cm
        </p>
        <p>{data.name}</p>        
      </article>
    </>
  );
}
