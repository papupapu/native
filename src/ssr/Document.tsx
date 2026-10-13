import type { ReactNode } from 'react';

interface DocumentProps {
  lang: string;
  css: string[];
  inlineCss: string[];
  children: ReactNode;
}

/**
 * Server-only document shell. The browser hydrates `#root`, not the whole document, so the
 * head (stylesheets, inlined critical CSS) never has to be reproduced on the client. Page
 * <title>/<meta> are rendered by the pages and hoisted to the head by React.
 */
export function Document({ lang, css, inlineCss, children }: DocumentProps) {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {inlineCss.map((rules, index) => (
          <style key={index} data-critical="" dangerouslySetInnerHTML={{ __html: rules }} />
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
