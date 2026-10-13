import type { ReactNode } from 'react';
import type { InlineCss } from '../shared/types.ts';

interface DocumentProps {
  lang: string;
  /** Stylesheets to link (everything that is not inlined). */
  css: string[];
  inlineCss: InlineCss[];
  children: ReactNode;
}

/**
 * Server-only document shell. The browser hydrates `#root`, not the whole document, so the
 * head (stylesheets, inlined critical CSS) never has to be reproduced on the client. Page
 * <title>/<meta> are rendered by the pages and hoisted to the head by React.
 *
 * Inlined CSS carries `data-href` = its public URL: before loading the CSS of a chunk, the
 * mini-css-extract-plugin runtime looks for a <link> or a <style> with that `data-href` and, if
 * it finds one, does not download the file again. Inlined files are therefore not linked.
 */
export function Document({ lang, css, inlineCss, children }: DocumentProps) {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {inlineCss.map(({ href, rules }) => (
          <style key={href} data-critical="" data-href={href} dangerouslySetInnerHTML={{ __html: rules }} />
        ))}
        {css.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
