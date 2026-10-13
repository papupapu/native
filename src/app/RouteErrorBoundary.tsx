import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error) ? error.statusText : 'Errore imprevisto';

  return (
    <section>
      <title>{`${status} ${message} | casa PoC`}</title>
      <meta name="robots" content="noindex" />
      <h1>
        {status} {message}
      </h1>
      <p>
        <Link to="/">Torna alla home</Link>
      </p>
    </section>
  );
}
