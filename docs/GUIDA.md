# Guida al PoC (for dummies)

Come funziona questo progetto, dove sta cosa e come aggiungere una pagina con i suoi dati.
Per le decisioni di design e la tabella delle verifiche vedi il [README](../README.md); qui
si spiega **come ragionare** quando ci si mette le mani.

Indice

1. [L'idea in 2 minuti](#1-lidea-in-2-minuti)
2. [Cartelle: cosa sta dove](#2-cartelle-cosa-sta-dove)
3. [Webpack: dove è configurato](#3-webpack-dove-è-configurato)
4. [Server vs client: tre mondi, un solo codice](#4-server-vs-client-tre-mondi-un-solo-codice)
5. [Cosa succede a una richiesta](#5-cosa-succede-a-una-richiesta)
6. [Il routing](#6-il-routing)
7. [Il data fetching](#7-il-data-fetching)
8. [Aggiungere una nuova rotta con fetch, passo per passo](#8-aggiungere-una-nuova-rotta-con-fetch-passo-per-passo)
9. [Best practice](#9-best-practice)
10. [Scalabilità](#10-scalabilità)
11. [Trappole note](#11-trappole-note)
12. [Comandi](#12-comandi)

---

## 1. L'idea in 2 minuti

È un sito **server-side rendered (SSR)** che, una volta caricato, si comporta come una **SPA**
(single page application).

- **Prima visita (o bot, o link aperto in una nuova scheda):** il server Node/Express costruisce
  l'HTML completo della pagina, dati inclusi. Il browser lo mostra subito, poi "risveglia" la pagina
  con JavaScript (questa fase si chiama **hydration**).
- **Navigazioni successive (click su un link):** non si ricarica niente. Il router nel browser
  scarica il codice della nuova pagina (se serve), chiede i dati e ridisegna solo ciò che cambia.

Il filo conduttore è sempre lo stesso, in server e in browser:

```
URL ──► route (quale pagina?) ──► loader (carica i dati) ──► store Redux ──► componente (li mostra)
```

Quattro regole che spiegano quasi tutto:

1. **Ogni pagina è una "route"** con un `loader` (prende i dati), un `Component` (li mostra) e
   una `slice` Redux (dove li mette).
2. **Il loader gira sul server per la prima richiesta e nel browser per le navigazioni.** Lo stesso
   codice, due posti.
3. **Il server serializza lo stato nella pagina**, così il browser parte già con i dati e non
   rifà le fetch.
4. **Il codice di ogni pagina è in un file JS separato** (chunk), scaricato solo quando serve.
   Lo stesso vale per la modale (al click). Header e footer, invece, sono import statici: stanno
   nell'HTML del server e nel CSS di `main`.

---

## 2. Cartelle: cosa sta dove

```
portal/
├── build/                    Configurazione di webpack e script di build (vedi §3)
│   ├── webpack.client.ts       bundle per il browser
│   ├── webpack.server.ts       bundle per l'SSR (un unico file .cjs)
│   ├── shared.ts               regole condivise: swc (TS/JSX) e SCSS
│   ├── AssetManifestPlugin.ts  produce manifest.json: "quali file servono a quale pagina"
│   ├── build.ts                `npm run build`
│   ├── dev.ts                  `npm run dev`
│   ├── check-bundle.ts         `npm run check:bundle`: controlla che le parti lazy (modale, ...) non finiscano nel bundle iniziale
│   ├── bundle-compare.ts       `npm run bundle:compare`: peso del JS di primo caricamento per route, confrontato col merge-base
│   └── bundle-budget.json      soglie (delta e assolute) usate da bundle-compare.ts
├── src/
│   ├── server/               Express (gira direttamente in Node, NON passa da webpack)
│   │   ├── boot.ts             avvio in produzione: config → warm-up → listen → shutdown
│   │   ├── app.ts              tutti i middleware, nell'ordine in cui vengono montati
│   │   ├── config.ts           PORT (validata all'avvio), NODE_ENV, cartella dist
│   │   ├── api/router.ts       /api/v1/*: gli endpoint che chiama il browser
│   │   ├── middleware/         context (dominio, lingua, bot?), headers, seoRedirect, errors
│   │   └── ssr/                renderer.ts carica dist/server/render.cjs; assets.ts legge manifest e CSS critico
│   ├── ssr/                  La parte JSX del rendering server (passa da webpack → render.cjs)
│   │   ├── render.tsx          il cuore: query del router → status → renderToPipeableStream
│   │   ├── Document.tsx        <html><head>…<body><div id="root"> (solo server)
│   │   └── serialize.ts        come lo stato finisce dentro la pagina, in sicurezza
│   ├── client/entry.tsx      Entry del browser: ricostruisce store e router, poi hydrateRoot
│   ├── app/                  L'applicazione vera, condivisa da server e browser
│   │   ├── routes.ts           l'albero delle route
│   │   ├── AppShell.tsx        header + <Outlet/> + footer (persistente tra le pagine); qui stanno i dati di header e footer
│   │   ├── RouteErrorBoundary.tsx  cosa si vede per 404/500 (dentro la shell)
│   │   ├── types.ts            RouteHandle: i metadati di ogni route
│   │   ├── pages/<pagina>/     route.ts + slice.ts + Page.tsx (+ Page.module.scss solo se serve)
│   │   ├── modal/              registry + provider + una modale per file (LoginModal.tsx): la modale si carica al click
│   │   └── lazy/               resolveLazyMatches, useOnVisible (per ora inutilizzato)
│   ├── components/           Componenti presentazionali riusabili (props in, markup out), import statici
│   │   ├── Header/             Header.tsx + Header.module.scss
│   │   ├── Footer/             Footer.tsx (solo classi utility, nessun modulo)
│   │   ├── Button/             Button.tsx + Button.module.scss (usato da LoginButton in AppShell e dalle modali)
│   │   └── Modal/              Modal.tsx + Modal.module.scss: la shell standard di ogni modale (lo importano solo i chunk modal-*)
│   ├── store/                Redux Toolkit: makeStore, rootReducer, hook tipizzati, storeContext
│   ├── services/             Accesso ai dati: tipi, fixture, versione "in-process" e versione "browser"
│   ├── globals.d.ts          dichiara __DEV__, i campi di window e i moduli .scss
│   ├── shared/               Tipi usati da server e bundle SSR (RequestCtx, PublicConfig, manifest)
│   └── styles/               _tokens.scss: token di design (finti) e mappe Sass, iniettati in ogni .scss
│                             utilities.scss: classi utility globali generate dalle mappe (solo AppShell lo importa)
└── dist/                     Output di `npm run build` (non si committa)
    ├── client/                 JS/CSS per il browser + manifest.json
    └── server/render.cjs       il bundle SSR
```

Regola pratica: **tutto quello che serve a una pagina sta nella cartella della pagina**
(`src/app/pages/<pagina>/`). Se aggiungi una pagina non dovresti toccare più di una manciata di
altri file (vedi §8).

---

## 3. Webpack: dove è configurato

Non c'è un `webpack.config.js` nella root e non si usa `webpack-cli`. La configurazione è in
TypeScript dentro [`build/`](../build) e viene eseguita da due script Node che usano l'API di
webpack:

| File | Cosa fa |
| --- | --- |
| [`build/webpack.client.ts`](../build/webpack.client.ts) | Config del **bundle per il browser**: entry `src/client/entry.tsx`, nomi dei file con hash (solo in produzione), `splitChunks` (solo un chunk `vendor`), plugin (DefinePlugin, estrazione CSS, manifest, HMR/React Refresh in dev, analyzer con `ANALYZE=1`) |
| [`build/webpack.server.ts`](../build/webpack.server.ts) | Config del **bundle SSR**: entry `src/ssr/render.tsx`, output unico `dist/server/render.cjs` (CommonJS), con tutte le dipendenze npm incluse |
| [`build/shared.ts`](../build/shared.ts) | Le regole dei loader usate da entrambe: `swc-loader` per TS/JSX e `css-loader` + `sass-loader` per gli SCSS (CSS Modules per i `*.module.scss`, token iniettati con `additionalData`) |
| [`build/AssetManifestPlugin.ts`](../build/AssetManifestPlugin.ts) | Plugin nostro: scrive `dist/client/manifest.json` con i file di `main`/`vendor` e di ogni chunk con nome (`route-*`, `modal-*`) |
| [`build/build.ts`](../build/build.ts) | `npm run build`: avvia le due compilazioni (client + server), scrive anche `dist/stats.json` |
| [`build/dev.ts`](../build/dev.ts) | `npm run dev`: stesse config con `dev: true`, montate dentro Express con `webpack-dev-middleware` + `webpack-hot-middleware` |

Cose che si toccano più spesso:

- **Aggiungere un loader o un plugin** → `webpack.client.ts` (e `webpack.server.ts` se serve anche
  all'SSR). Una regola per entrambi → `shared.ts`.
- **Cambiare come si spezzano i chunk** → `optimization.splitChunks` in `webpack.client.ts`.
- **Il nome di un chunk** non si configura qui: lo decide il commento magico `/* webpackChunkName: "route-x" */`
  nel punto in cui si fa `import()`.
- Il server Express **non** passa da webpack: `src/server/**` gira con Node (type stripping), per
  questo lì valgono regole più rigide (§4).

---

## 4. Server vs client: tre mondi, un solo codice

La stessa app gira in tre ambienti diversi. Capire quale è quale evita il 90% della confusione.

| | **Express** (`src/server/`) | **Bundle SSR** (`dist/server/render.cjs`) | **Bundle browser** (`dist/client/*.js`) |
| --- | --- | --- | --- |
| Gira dove | Node, direttamente | Node, dentro Express | Browser |
| Compilato da | nessuno (Node 24 toglie i tipi) | webpack (`webpack.server.ts`) | webpack (`webpack.client.ts`) |
| Contiene | middleware, API, avvio | `src/ssr/` + `src/app/` + store + services | `src/client/` + `src/app/` + store + services |
| Ha JSX? | **No** | Sì | Sì |
| Ha `window`/`document`? | No | No | Sì |

### Cosa è condiviso e cosa no

- `src/app/`, `src/store/`, `src/services/` finiscono **in entrambi** i bundle (SSR e browser).
  Tutto ciò che scrivi lì deve poter girare in Node *e* nel browser.
- `src/server/` esiste solo sul server. Non va importato da `src/app/`.
- **Eccezione da ricordare:** Express importa direttamente anche `src/services/inProcess.ts` (con
  `fixtures.ts` e `types.ts`) per l'API `/api/v1`, e `src/shared/*`. Quei file girano **anche** con il
  type stripping di Node, quindi seguono le regole di `src/server/` (sotto): estensione `.ts` negli
  import, niente `enum`/`namespace`, niente JSX.
- `src/ssr/` esiste solo nel bundle SSR. `src/client/` solo nel browser.
- `src/shared/` contiene tipi e contratti usati da `src/server/` e dal bundle SSR. Express non può
  importare file `.tsx`: per questo il ponte verso il rendering è il contratto `RenderModule`
  (`render(req, res, …)`).

### Regole del codice sul server (`src/server/`)

Node esegue i `.ts` togliendo i tipi, quindi:

- nei `import` locali l'estensione è obbligatoria: `from './app.ts'`;
- solo sintassi "cancellabile": **niente** `enum`, `namespace`, parameter properties nei costruttori;
- niente JSX.

### Codice che deve comportarsi diversamente

- **Codice solo browser** (`window`, `localStorage`, `IntersectionObserver`): mettilo dentro
  `useEffect`, che sul server non gira. Non leggerli mai durante il render.
- **Codice solo server** (cookie, header, segreti): sta in `src/server/` e **non** entra nello stato.
  Quello che il browser può vedere sta in `PublicConfig` (`src/shared/types.ts`), una *whitelist*
  esplicita.

### Il test della hydration

Il browser, nel primo render, deve produrre **lo stesso HTML** che il server ha mandato. Se non
coincide, React lo segnala (`onRecoverableError` in `entry.tsx` scrive `[hydration]` in console).
Cause tipiche: `Date.now()`, `Math.random()`, `typeof window` nel render, dati diversi tra
server e browser.

---

## 5. Cosa succede a una richiesta

### 5.1 Prima visita (server)

```
Browser: GET /annunci/1
   │
   ▼
Express (src/server/app.ts), nell'ordine:
   /status, /favicon.ico, /.well-known/appspecific, /api/v1, file statici (/static),
   cookieParser, securityHeaders, requestContext (dominio, lingua, bot?), seoRedirect (301)
   │
   ▼  catch-all  app.get('/{*splat}')  →  render.cjs
src/ssr/render.tsx
   1. makeStore(...)               un NUOVO store Redux per questa richiesta
   2. handler.query(request)       il router trova la route e lancia i suoi loader
          └─ loader → thunk → services (in-process, nessuna chiamata HTTP) → store
   3. se il loader ha lanciato redirect()  → risponde 30x e finisce
   4. status = result.statusCode   200, 404… deciso PRIMA di mandare il primo byte
   5. sceglie i file: main + vendor + chunk della route (mai JS né CSS della modale)
   6. renderToPipeableStream(<Document><Provider><StaticRouterProvider/></Provider></Document>)
   7. lo stato (store + dati del router) viene scritto in uno <script> nella pagina
   ▼
Browser riceve HTML completo + <script> con lo stato
```

Dettagli utili:

- I bot (`isBot`) ricevono l'HTML solo quando tutto è pronto (`onAllReady`); gli altri appena la
  "shell" è pronta (`onShellReady`), con il resto in streaming.
- Nello stato serializzato finiscono solo `config` e le slice **delle route che hanno matchato**
  (`handle.slices`). I cookie non ci arrivano mai.
- In produzione il CSS di `main` e della route è **inlinato** nell'`<head>` (CSS critico) invece di
  essere linkato: il primo paint non aspetta nessun `.css`. Dettagli ed esempio in
  [§10, "CSS critico"](#css-critico-come-funziona-e-come-usarlo).

### 5.2 Nel browser: avvio e hydration (`src/client/entry.tsx`)

L'**ordine** è importante:

```
1. legge window.__INITIAL_STATE__ e window.__ROUTER_DATA__ (poi li cancella)
2. resolveLazyMatches   scarica/risolve i pezzi lazy delle route matchate → le slice si registrano
3. makeStore({ preloadedState })   SOLO ORA, perché lo store scarta le chiavi di slice che ancora non conosce
4. createBrowserRouter(routes, { hydrationData })   parte con i dati del server: i loader NON rigirano
5. hydrateRoot(#root, ...)   React "aggancia" l'HTML esistente
```

### 5.3 Click su un link (navigazione client)

```
Click su <Link to="/annunci/2">
   → il router trova la route e carica i suoi pezzi lazy (se non già in cache)
   → esegue il loader nel BROWSER
         loader → thunk → services del browser → fetch('/api/v1/listings/2') → Express /api/v1
   → quando il loader finisce, aggiorna URL e UI (nessun reload; il vecchio contenuto resta fino a quel momento)
```

La differenza con il server è una sola riga: i `services` sono diversi (in-process vs `fetch`).
Per tutto il resto il codice è identico.

---

## 6. Il routing

Il router è **React Router 8 in "data mode"**: le route sono oggetti con `loader` e `Component`,
non JSX. L'albero sta in [`src/app/routes.ts`](../src/app/routes.ts):

```
root  (path "/", AppShell: header + Outlet + footer, sempre montata)
 └─ content  (senza path: serve solo ad avere un ErrorBoundary DENTRO la shell)
     ├─ home      index
     ├─ listing   annunci/:id
     ├─ search    cerca
     └─ notfound  *   (catch-all: il loader lancia sempre 404)
```

Perché la route `content` senza path? Gli errori (404, 500) si vedono **dentro** la shell, con
header e footer, invece di sostituire l'intera pagina.

### Anatomia di una route

```ts
export const listingRoute: RouteObject = {
  id: 'listing',                      // univoco
  path: 'annunci/:id',                // :id arriva in params['id']
  handle,                             // i nostri metadati (RouteHandle, sotto)
  async loader({ context, params, request }) { … },   // prende i dati
  lazy: { Component: async () => (await import('./Page.tsx')).Page },  // il componente, in un chunk a parte
};
```

`handle` è un oggetto tipizzato (`RouteHandle`, in `src/app/types.ts`):

| Campo | A cosa serve |
| --- | --- |
| `pageType` | etichetta della pagina (`'home'`, `'listing'`…) |
| `chunk` | nome del chunk della route (`'route-listing'`): il server lo usa per sapere quali file JS/CSS mettere nella pagina |
| `slices` | quali slice Redux appartengono alla route: **solo queste** vengono serializzate nella pagina |

### Cosa decide lo status HTTP

Lo decide il loader (solo il render del server lo trasmette; nelle navigazioni client non esiste):

| Nel loader | Effetto |
| --- | --- |
| `return null` (o dati) | 200, pagina normale |
| `throw redirect('/altrove')` | il server risponde con il 30x |
| `throw data(null, { status: 404 })` | 404 e **al posto della pagina** compare l'ErrorBoundary |
| `return data(null, { status: 404 })` | 404 e **la pagina viene comunque renderizzata** (es. ricerca con 0 risultati) |
| un errore qualsiasi (`throw new Error`, thunk rifiutato) | 500. Il messaggio non arriva al browser (né nei dati del router né nella slice, che salva il testo fisso `REQUEST_FAILED`); l'errore vero si legge nel log del server (primo caricamento) o nella console del browser (navigazione client): vedi §9.2 |

I redirect permanenti "SEO" (`/vecchia-url → /annunci/1`) non passano dal router ma da
`src/server/middleware/seoRedirect.ts`.

### Link e navigazione

- `<Link to="/x">` → navigazione client.
- `<Link to="/x" reloadDocument>` → ricarica completa (utile per i redirect lato server).
- `<Form method="get" action="/cerca">` → navigazione client con i campi nella query string
  (la pagina di ricerca ne è l'esempio).
- Cambiando solo la query string (`?q=…`) il loader **rigira**: è così che la ricerca si aggiorna.

---

## 7. Il data fetching

Il percorso dei dati ha 5 anelli. Ognuno ha un solo compito:

```
 services/        thunk (slice.ts)        slice.ts            route.ts             Page.tsx
┌──────────┐    ┌───────────────────┐   ┌─────────────┐    ┌────────────────┐   ┌────────────┐
│ "dammi i │ →  │ chiama il service │ → │ salva il    │ ←  │ il LOADER fa   │   │ legge dallo│
│  dati"   │    │ e ritorna dati    │   │ risultato   │    │ dispatch(thunk)│   │ store con  │
└──────────┘    └───────────────────┘   │ nello store │    │ e decide lo    │   │ useAppSel. │
                                        └─────────────┘    │ status         │   └────────────┘
                                                           └────────────────┘
```

### 1) `services/`: da dove vengono i dati

[`src/services/types.ts`](../src/services/types.ts) definisce il contratto `Services`
(`home.fetch()`, `listing.fetch(id)`, `search.fetch(query)`, `swpeople.fetch(id)`). Ci sono due implementazioni:

| | `inProcess.ts` | `browser.ts` |
| --- | --- | --- |
| Usata da | server (SSR) e dall'API Express | browser |
| Come ottiene i dati | direttamente (qui: fixture + 50 ms di ritardo finto; `swpeople` chiama `https://swapi.dev/api`, timeout 5 s) | `fetch('/api/v1/...')` |

Lo **stesso** `inProcess.ts` è usato anche da `src/server/api/router.ts`, quindi il server e
l'endpoint che chiama il browser rispondono con gli stessi dati. Il server **non** si richiama via HTTP
da solo (a differenza di portal18): niente loopback.

In un'app vera `inProcess.ts` chiamerebbe il backend reale, ed è l'unico file da cambiare.

### 2) Il thunk

Dentro `slice.ts`. Usa i service tramite `extra` (iniettati in `makeStore`):

```ts
export const fetchListing = createAppAsyncThunk('listing/fetch', (id: string, { extra }) => extra.listing.fetch(id));
```

### 3) La slice

Tiene `{ status, data, error }` e reagisce a `pending`/`fulfilled`/`rejected`. L'ultima riga:

```ts
export const { selectSlice: selectListing } = listingSlice.injectInto(rootReducer);
```

registra la slice nel reducer **quando il modulo viene valutato**, cioè quando il chunk della route
viene caricato. È quello che permette lo splitting dello stato.

### 4) Il loader

Piccolo e sempre uguale. Vive nel bundle principale, ma **prima** carica il chunk della sua route
(così la slice esiste quando parte il thunk):

```ts
async loader({ context, params }) {
  const { fetchListing } = await import(/* webpackChunkName: "route-listing" */ './slice.ts');
  const listing = await context.get(storeContext).dispatch(fetchListing(params['id'] ?? '')).unwrap();
  if (!listing) throw data(null, { status: 404, statusText: 'Not Found' });
  return null;
}
```

`context.get(storeContext)` è lo store giusto: quello della richiesta (server) o della pagina (browser).
`.unwrap()` fa sì che un thunk rifiutato diventi un'eccezione.

### 5) La pagina

Legge dallo store, non dal valore di ritorno del loader:

```tsx
const { data } = useAppSelector(selectListing);
if (!data) return null;
```

Metadati SEO: `<title>` e `<meta>` si scrivono direttamente nel JSX della pagina; React 19 li sposta
nell'`<head>`.

---

## 8. Aggiungere una nuova rotta con fetch, passo per passo

Esempio: pagina **agenzia** `/agenzie/:slug`, che mostra nome e città. Sono 9 passi: dal 1 al 5 il
layer dati (contratto, service, API, store, slice), poi route, pagina e collegamento.

### Passo 1: il tipo e il contratto del service

`src/services/types.ts`

```ts
export interface Agency {
  slug: string;
  name: string;
  city: string;
}

export interface Services {
  home: { fetch(): Promise<HomeData> };
  listing: { fetch(id: string): Promise<Listing | null> };
  search: { fetch(query: string): Promise<SearchResult> };
  agency: { fetch(slug: string): Promise<Agency | null> };   // ← nuovo
}
```

Convenzione: `null` significa "non esiste" (diventerà un 404).

### Passo 2: l'implementazione server (e i dati finti)

`src/services/fixtures.ts`

```ts
export const AGENCIES: Agency[] = [
  { slug: 'centro-casa', name: 'Centro Casa', city: 'Milano' },
  { slug: 'mare-immobiliare', name: 'Mare Immobiliare', city: 'Rimini' },
];
```

(aggiungi `Agency` all'import di tipi in testa al file)

`src/services/inProcess.ts` (dentro l'oggetto restituito da `createInProcessServices`)

```ts
agency: {
  async fetch(slug) {
    await delay(latencyMs);
    return AGENCIES.find((agency) => agency.slug === slug) ?? null;
  },
},
```

(e importa `AGENCIES`.)

### Passo 3: endpoint per il browser e implementazione browser

`src/server/api/router.ts`

```ts
router.get('/agencies/:slug', async (req, res) => {
  const agency = await services.agency.fetch(req.params['slug'] ?? '');
  if (!agency) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(agency);
});
```

`src/services/browser.ts` (aggiungi `Agency` all'import dei tipi)

```ts
agency: {
  fetch(slug) {
    return getJson<Agency>(`/api/v1/agencies/${encodeURIComponent(slug)}`);
  },
},
```

`getJson` restituisce già `null` su 404.

### Passo 4: registra il tipo dello stato

`src/store/types.ts`

```ts
import type { Agency, HomeData, Listing, SearchResult } from '../services/types.ts';

export interface LazyLoadedSlices {
  home: AsyncState<HomeData>;
  listing: AsyncState<Listing>;
  search: AsyncState<SearchResult>;
  agency: AsyncState<Agency>;     // ← nuovo
}
```

### Passo 5: la slice

`src/app/pages/agency/slice.ts` (copia quella di `listing` e cambia i nomi)

```ts
import { createSlice } from '@reduxjs/toolkit';
import type { Agency } from '../../../services/types.ts';
import { createAppAsyncThunk } from '../../../store/hooks.ts';
import { REQUEST_FAILED } from '../../../store/errors.ts';
import { rootReducer } from '../../../store/rootReducer.ts';
import type { AsyncState } from '../../../store/types.ts';

export const fetchAgency = createAppAsyncThunk('agency/fetch', (slug: string, { extra }) => extra.agency.fetch(slug));

const initialState: AsyncState<Agency> = { status: 'idle', data: null, error: null };

export const agencySlice = createSlice({
  name: 'agency',                 // deve coincidere con la chiave in LazyLoadedSlices
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgency.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAgency.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchAgency.rejected, (state) => {
        state.status = 'failed';
        state.error = REQUEST_FAILED;   // testo fisso: la slice finisce nell'HTML (vedi §9.2)
      });
  },
});

export const { selectSlice: selectAgency } = agencySlice.injectInto(rootReducer);
```

### Passo 6: la route

`src/app/pages/agency/route.ts`

```ts
import { data } from 'react-router';
import type { RouteObject } from 'react-router';
import { storeContext } from '../../../store/storeContext.ts';
import type { RouteHandle } from '../../types.ts';

const handle: RouteHandle = { pageType: 'agency', chunk: 'route-agency', slices: ['agency'] };

export const agencyRoute: RouteObject = {
  id: 'agency',
  path: 'agenzie/:slug',
  handle,
  async loader({ context, params }) {
    const { fetchAgency } = await import(/* webpackChunkName: "route-agency" */ './slice.ts');
    const agency = await context.get(storeContext).dispatch(fetchAgency(params['slug'] ?? '')).unwrap();
    if (!agency) throw data(null, { status: 404, statusText: 'Not Found' });
    return null;
  },
  lazy: {
    Component: async () => (await import(/* webpackChunkName: "route-agency" */ './Page.tsx')).Page,
  },
};
```

Le tre stringhe `route-agency` (in `handle.chunk` e nei due `webpackChunkName`) **devono essere
identiche**: il server cerca nel manifest il gruppo chiamato come `handle.chunk`, e se non lo trova
la pagina esce senza il suo JS e CSS. Il prefisso `route-` è imposto dal tipo (`` `route-${string}` ``)
e serve anche al CSS critico inlinato e a `check:bundle`, che lo usano per riconoscere i chunk di route.

### Passo 7: la pagina

`src/app/pages/agency/Page.tsx`

```tsx
import { Link } from 'react-router';
import { useAppSelector } from '../../../store/hooks.ts';
import { selectAgency } from './slice.ts';

export function Page() {
  const { data } = useAppSelector(selectAgency);
  if (!data) return null;

  return (
    <>
      <title>{`${data.name} | casa PoC`}</title>
      <article className="py-4">
        <p>
          <Link to="/">← Home</Link>
        </p>
        <h1 className="m-0 mb-2 fs-title">{data.name}</h1>
        <p className="color-text-muted">{data.city}</p>
      </article>
    </>
  );
}
```

Gli stili sono classi utility (§9.3), già disponibili perché `AppShell` importa `utilities.scss`: la
pagina non importa nulla. Se serve qualcosa che le utility non coprono (un `grid-template-columns`, un
font-size fuori scala) crea `src/app/pages/agency/Page.module.scss`: i token (`$space-4`,
`$color-text-muted`…) sono disponibili senza import. Le classi del modulo si leggono con
`styles['agency']` (con parentesi quadre: è la convenzione del progetto) e si uniscono alle utility con
un template string; la stessa proprietà non va messa sia in una utility sia nel modulo.

### Passo 8: collega la route

`src/app/types.ts` → aggiungi `'agency'` a `pageType`:

```ts
pageType: 'shell' | 'home' | 'listing' | 'search' | 'agency' | 'notfound';
```

`src/app/routes.ts`

```ts
import { agencyRoute } from './pages/agency/route.ts';
// …
children: [homeRoute, listingRoute, searchRoute, agencyRoute, notFoundRoute],   // l'ordine non conta (vince la route più specifica), per convenzione notFound resta in fondo
```

### Passo 9: verifica

```bash
npm run typecheck
npm run build && npm run check:bundle        # (cerca tu `route-agency` nell'output: check:bundle non lo pretende, controlla che i chunk route non contengano la modale)
PORT=3100 npm start                            # (in un altro terminale; 3100 per non scontrarsi col dev server)
curl -s -o /dev/null -w "%{http_code}\n" localhost:3100/agenzie/centro-casa   # 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:3100/agenzie/nope           # 404
curl -s localhost:3100/agenzie/centro-casa | grep -o '<h1>[^<]*'               # i dati sono nell'HTML
```

E nel browser: apri la pagina, poi naviga *verso* di essa da un link (aggiungine uno in
`AppShell.tsx`) e controlla che non ci sia un reload completo e che la console sia vuota.

### Checklist di errori tipici

| Sintomo | Causa probabile |
| --- | --- |
| La pagina si vede sul server ma "lampeggia" o la console dice `[hydration]` | `handle.slices` non contiene la slice: lo stato non è stato serializzato |
| `Cannot read properties of undefined` nel loader sul server | il loader non fa `await import('./slice.ts')` prima del dispatch |
| Il 404 mostra la pagina vuota invece del messaggio | hai fatto `return data(...)` invece di `throw data(...)` (vedi tabella §6) |
| Pagina senza il suo JS/CSS (stile mancante, nessuna hydration) | `handle.chunk` non coincide con il `webpackChunkName` usato negli `import()` |
| TypeScript si lamenta su `state.agency` | manca la chiave in `LazyLoadedSlices` |
| La route `*` risponde al posto della tua | il `path` della tua route non combacia con l'URL (l'ordine nell'array non c'entra) |

### 8.1 Aggiungere una modale

Ogni modale è un chunk lazy che mette il suo contenuto dentro la shell standard `Modal`
(`src/components/Modal/Modal.tsx`).

1. **Crea `src/app/modal/<Nome>Modal.tsx`** (export default) che riceve `ModalProps` e li passa alla shell:

   ```tsx
   import type { ModalProps } from './registry.ts';
   import { Modal } from '../../components/Modal/Modal.tsx';

   export default function ContactModal(props: ModalProps) {
     return (
       <Modal {...props} size="md" title="Contattaci" footer={/* bottoni, opzionale */}>
         {/* contenuto */}
       </Modal>
     );
   }
   ```

   `ModalProps` è `{ onClose, closing, onExited }`: li fornisce `ModalProvider`, la modale non li gestisce.
   Per il resto la modale non ha logica di apertura/chiusura né CSS proprio: usa le classi utility (§9.3).
2. **Registrala in `src/app/modal/registry.ts`** con un `import()` letterale e un `webpackChunkName` `modal-<nome>`
   (mai un template literal). `ModalId` si aggiorna da solo. `check:bundle` la trova senza altre registrazioni;
   per il controllo sulla stringa esporta una costante `*_MARKER` come `MODAL_MARKER` in `LoginModal.tsx`.
3. **Aprila** con `useModal().open('<id>')`; per scaricare il chunk prima del click chiama `prefetch('<id>')` da
   `onPointerEnter` / `onFocus` del bottone (vedi `LoginButton` in `AppShell.tsx`).

Le props della shell (tutte opzionali tranne `children` e uno tra `title` e `ariaLabel`):

| Prop | Valori | Effetto |
| --- | --- | --- |
| `size` | `'sm'` / `'md'` / `'lg'` (default `md`) | larghezza 400 / 560 / 800px, sempre limitata al viewport; l'altezza segue il contenuto e il corpo scorre oltre il viewport |
| `mobile` | `'fullscreen'` (default) / `'dialog'` | sotto `$breakpoint-md` (768px) `fullscreen` occupa 100vw x 100dvh e sale dal basso; `dialog` resta un riquadro centrato |
| `title` | nodo React | header standard con `h2` e pulsante di chiusura; senza `title` il tipo richiede `ariaLabel` |
| `footer` | nodo React | barra di azioni standard; assente se omesso |
| `closeButton` | `true` (default) / `false` | la X sta nel header, o fluttua nell'angolo se non c'è il `title` |

Cosa fa la shell per te: `<dialog>` nativo aperto con `showModal()` (top layer, focus trap, pagina dietro inerte),
Escape e click sul backdrop chiudono, lo scroll della pagina è bloccato (`overflow: hidden` su `<html>`), animazioni
di apertura e chiusura (`@keyframes` su `data-state`, disattivate con `prefers-reduced-motion`). Un elemento con
`data-autofocus` riceve il focus iniziale. Per un bottone di submit nel footer, fuori dal `<form>`, usa
`<Button type="submit" form={formId} ...>` con lo stesso `id` del form (vedi `LoginModal.tsx`).

Ciclo di vita: `close()` imposta solo `closing` nello stato di `ModalProvider` (`{ id, closing } | null`); la shell
aspetta la fine delle animazioni (`dialog.getAnimations({ subtree: true })`), chiama `dialog.close()` e l'evento
nativo `close` chiama `onExited`, che smonta la modale. **Importa `Modal` solo dai file in `src/app/modal/`**: se lo
importa `AppShell` o una pagina, la shell e il suo CSS finiscono in `main` o in una route (`check:bundle` non lo vede, perché controlla solo i file
importati con `import()`: guarda la differenza con `npm run bundle:compare`).

---

## 9. Best practice

### 9.1 Dove fare il parsing dei dati dopo la fetch

> Nel PoC i service restituiscono già oggetti "nel formato giusto" (sono fixture), quindi **un
> livello di parsing non esiste ancora**. Quello che segue è dove andrebbe messo.

**Regola:** il formato che arriva dal backend (DTO) si trasforma nel formato dell'app (modello) **una
volta sola, nel layer `services/`**, subito dopo la fetch. Mai nei componenti, mai nel loader.

```
backend (DTO)  →  services/ (mapper: DTO → modello)  →  thunk  →  store  →  selettore  →  componente
```

Perché lì:

- Il browser chiama `/api/v1`, che a sua volta usa `inProcess.ts`: **c'è un solo punto che parla con il
  backend**, quindi il mapper vive lì e il browser riceve già il modello. Se un giorno il browser
  chiamasse il backend direttamente, il mapper dovrebbe essere **una funzione condivisa**: due
  implementazioni che trasformano in modo diverso producono dati diversi tra server e browser (e si
  rompe la hydration).
- Quello che finisce nello store viene **scritto nell'HTML**. Più è pulito e piccolo, più la pagina
  è leggera.
- Se il backend cambia formato, si tocca un solo file.

Struttura consigliata, per ogni dominio:

```
src/services/agency/
  dto.ts       tipi "grezzi" come arrivano dal backend
  mapper.ts    toAgency(dto: AgencyDto): Agency
  (il tipo Agency, il modello, resta in services/types.ts)
```

```ts
// mapper.ts
export function toAgency(dto: AgencyDto): Agency {
  return {
    slug: dto.slug,
    name: dto.display_name.trim(),
    city: dto.address?.city ?? '', // valori di default qui, non nei componenti
    // una data del backend (es. dto.opened_at) si salva come stringa ISO, non come Date (vedi sotto)
  };
}
```

`inProcess.ts` (il solo che parla col backend) chiama `toAgency(dto)` prima di restituire; `browser.ts` non
si tocca perché riceve già il modello dall'API.

**Cosa va (e cosa non va) nello store:**

| Sì | No |
| --- | --- |
| Oggetti semplici, array, stringhe, numeri, booleani, `null` | `Date`, `Map`, `Set`, classi, funzioni (non sopravvivono alla serializzazione; in dev Redux Toolkit lo segnala) |
| Date come stringa ISO | Oggetti già formattati per la UI (formattare nel componente o nel selettore) |
| Solo i campi che servono alla pagina | La risposta del backend intera "così nel dubbio c'è tutto" |

**Dati derivati** (totali, filtri, ordinamenti, testo formattato): in un **selettore**
(`createSelector`) o nel componente, non salvati nello store. Lo store contiene i fatti, i selettori
calcolano il resto.

**Il loader no:** deve restare "dispatch + decisione sullo status". Se ci metti logica di
trasformazione, la duplichi tra pagine e la rendi difficile da testare.

### 9.2 Altre regole d'oro

1. **Un solo posto per il formato dei dati:** `services/types.ts`. Se un campo cambia, il compilatore
   ti guida su tutti i punti toccati.
2. **Il loader decide lo status** (404, redirect), il componente no. Lo status esiste solo se lo decidi
   prima del render.
3. **404 vs pagina vuota:** `throw data(…404)` = "questa risorsa non esiste", `return data(…404)` =
   "la pagina esiste ma è vuota, restituisci 404 e `noindex`".
4. **Lo store è per richiesta**, mai un singleton di modulo (nemmeno per cache "innocue": sul server
   sarebbe condiviso tra utenti diversi).
5. **Niente `Date.now()`, `Math.random()`, `window`** durante il render: usa `useEffect`.
6. **Titolo e meta** dentro la pagina, con `<title>` e `<meta>`.
7. **Metti `noindex`** nelle pagine che restituiscono 404/vuote (già fatto in `RouteErrorBoundary` e
   nella ricerca vuota).
8. **Il messaggio degli errori inattesi non deve arrivare al browser.** Due punti lo garantiscono:
   `serializeError` (dati del router) e la costante `REQUEST_FAILED` (`src/store/errors.ts`) che ogni
   slice salva nel ramo `rejected` al posto di `action.error.message`. Motivo: lo stato della slice
   viene scritto nell'HTML, e il messaggio di un errore può contenere dettagli interni (testato: un
   thunk che lancia `new Error('secret boom')` con il vecchio codice lasciava `"error":"secret boom"`
   nella pagina). L'errore vero si legge nel log del server: `render.tsx` lo stampa con
   `[ssr] loader error in "content"` (l'id della route che ha l'error boundary, non della pagina) per ogni errore che non sia una risposta attesa (404 ecc.).
   Quel log copre solo il **primo caricamento** (render sul server). Nelle navigazioni client il server non
   c'entra: l'errore lo logga `onError` di `RouterProvider` (`src/client/entry.tsx`) come `[router] error`
   nella console del browser. Se guardi solo il terminale dopo aver cliccato un link, non vedrai nulla.
   Per un messaggio da mostrare all'utente usa un codice (`'not_found'`, `'unavailable'`) e traducilo
   nel componente.

### 9.3 Stili: classi utility e CSS Modules

`src/styles/_tokens.scss` definisce, oltre alle variabili, quattro mappe Sass (`$spacers`, `$colors`,
`$font-sizes`, `$radii`) che non emettono CSS: le chiavi sono i suffissi delle classi.
`src/styles/utilities.scss` le legge con `@each` e genera classi **globali** (non modulo, nome non
hashato): `p-3`, `px-3`, `mb-2`, `mx-auto`, `gap-2`, `color-text-muted`, `bg-brand`, `border-color-border`,
`border`, `border-t`, `fs-small`, `fw-bold`, `rounded-1`, più gli helper di layout (`block`, `flex`,
`inline-flex`, `grid`, `flex-col`, `flex-wrap`, `flex-1`, `shrink-0`, `items-center`, `justify-center`,
`justify-between`, `justify-end`, `w-full`, `max-w-page`, `list-none`, `no-underline`). Nelle famiglie
dei colori le uniche due eccezioni scritte a mano, fuori dalle mappe (non esiste un token trasparente), sono `bg-transparent`
(dopo il ciclo `bg-*`) e `border-color-transparent` (dopo il ciclo `border-color-*`, così vince
comunque su `border`): le usa la variante `ghost` di `Button`. Non ci sono varianti responsive. Le classi sono emesse dalla più generale alla più specifica (`m-0` prima di `mb-2`,
`border-color-*` dopo `border*`), quindi `m-0 mb-2` funziona.

**Regole.**

1. **Una proprietà CSS viene da una utility *oppure* dal modulo del componente, mai da tutti e due sullo
   stesso elemento.** Il CSS di route è inlinato dopo quello di `main`: a parità di specificità vincerebbe
   in silenzio il modulo. **Eccezione: stati e pseudo-classi** (`:hover`, `:focus`, `:active`). Le utility
   non hanno varianti per le pseudo-classi, quindi gli stati stanno nel modulo e sovrascrivono la utility
   a riposo di proposito (la regola dello stato è più specifica). Esempio: `Button.tsx` mette sul
   `<button>` sia `styles[variant]` sia le utility di `VARIANTS` (`bg-brand`…); `.primary:hover` in
   `Button.module.scss` cambia `background` e `border-color` solo in hover. Nello stesso file `.button:focus`
   (outline 2px `$color-brand`, offset 2px; vale anche per il focus da tastiera, mentre dopo un click del
   mouse l'outline resta fino al blur) e `.button:active` (outline 2px `$color-text`) vanno in
   quest'ordine: `:active` viene dopo `:focus`, a pari specificità, e vince mentre il bottone è premuto.
   I tre colori degli stati (`$color-brand-dark`, `$color-grey-light`, `$color-grey-dark`) sono variabili
   in `_tokens.scss` **fuori dalle mappe**: nessuna classe utility li usa, quindi non generano CSS in `main`.
2. **I moduli tengono solo ciò che non ha un token o una utility:** `grid-template-columns`,
   `position`/`inset`, `rgba(...)`, larghezze con `min()`, font-size fuori scala, `font: inherit`,
   `cursor`, dimensioni di `svg` annidati, `@keyframes`, `::backdrop`, media query, stati e pseudo-classi.
   Il breakpoint `$breakpoint-md` (768px) è una variabile in `_tokens.scss` **fuori dalle mappe** (nessuna
   utility, niente varianti responsive): lo usa `Modal.module.scss` con `@media (max-width: #{$breakpoint-md - 1px})`. Un selettore discendente (`.card h2`) diventa una classe messa
   sull'elemento.
3. **`utilities.scss` si importa solo in `src/app/AppShell.tsx`** (subito dopo `./global.scss`): così sta
   una sola volta in `main` (circa 3,9 KB, 1,29 KB gzip). Se lo importi da una pagina o da un componente
   viene duplicato nel CSS di ogni route.
4. **Le classi si uniscono con i template string**, con le classi del modulo per prime:
   `` className={`${styles['cards']} grid gap-3 m-0 p-0 list-none`} ``.

**Come aggiungere una utility o un token.**

- Nuovo valore di una scala esistente (un `$space-6`): aggiungi la variabile e la chiave nella mappa in
  `_tokens.scss`; la classe (`p-6`, `gap-6`…) nasce da sola.
- Nuova famiglia (per esempio `opacity-*`): una mappa in `_tokens.scss` e un blocco `@each` in
  `utilities.scss`, mettendolo prima di ciò che deve poter sovrascrivere.
- Utility singola senza token (`.flex-col`): una regola in `utilities.scss`.

Costo: il CSS critico di `main` passa da circa 1,1 KB a circa 4,3 KB (il budget è 14 KB, vedi §10) e il
JS di primo caricamento sale di 0,13-0,20 KB gzip per route.

---

## 10. Scalabilità

Cosa tenere d'occhio quando le pagine passano da 3 a 30 e i team da 1 a 5.

### Struttura

- **Una route = una cartella = un chunk = una slice.** I confini sono chiari e i team non si pestano i piedi.
  Aggiungere una pagina è quasi tutto in `pages/<x>/`.
- **`services/` è il confine verso il backend.** Quando i domini crescono, una sottocartella per dominio
  (`services/agency/`, `services/listing/`…) con DTO, mapper e client; `Services` resta l'interfaccia unica.
- **Entità condivise tra pagine** (lo stesso annuncio in ricerca, dettaglio, preferiti): `createEntityAdapter`
  di Redux Toolkit per tenere un solo record per id, invece di copie nelle singole slice.
- **Componenti condivisi** in `src/app/components/` (da creare): le pagine non si importano a vicenda.

### Performance di caricamento

- **Il bundle iniziale deve restare piccolo:** `main` e `vendor` contengono solo ciò che serve a ogni
  pagina. Ogni nuova libreria pesante va in un chunk lazy (modale, pagina, componente sotto la piega).
- **`npm run check:bundle` in CI.** Fallisce se una parte lazy (modale, qualsiasi `import()` con `webpackChunkName` non `route-`) finisce nel bundle iniziale o nei chunk di route, o se il suo chunk manca: è
  il modo più economico per accorgersi di una regressione.
- **`npm run bundle:compare` prima di una PR** (dopo `build`). Misura il JS gzip di primo caricamento per route e lo confronta col merge-base con master (la baseline si compila una volta in un git worktree `.bundle-baseline/` e resta in cache in `node_modules/.cache/bundle-guard/`). Le soglie sono in `build/bundle-budget.json`. Exit 0 ok o avvisi, 1 BLOCKER, 2 non misurabile. Opzioni: `--modules`, `--json`, `--base=<ref>`, `--rebuild-base`, `--allow-stale`.
- **Import dinamici sempre con stringa letterale** (vedi `modal/registry.ts`). Con un template literal
  webpack include tutti i file della cartella.
- **Mai una cacheGroup `common` con `chunks: 'all'`** in `splitChunks` (è il problema di portal18): riporta
  codice lazy nel bundle iniziale.
- **`npm run analyze`** per vedere cosa pesa.

#### CSS critico: come funziona e come usarlo

**Cosa succede.** In produzione `readCriticalCss` (`src/server/ssr/assets.ts`) legge una volta all'avvio i
file CSS di `main` e di ogni gruppo `route-*`. Per ogni richiesta `render.tsx` prende quelli di `main` e
della route corrente e `Document.tsx` li scrive nell'`<head>` come
`<style data-critical data-href="/static/route-home.<hash>.css">…</style>`. I file inlinati **non vengono
linkati**: un `<link rel="stylesheet">` blocca il render e annullerebbe il vantaggio dell'inline. Gli
altri file CSS della pagina (se ce ne sono) restano `<link>`.

L'attributo `data-href` contiene l'URL pubblico del file. Il runtime di `mini-css-extract-plugin`, prima di
scaricare il CSS di un chunk, cerca un `<link>` o uno `<style>` con quel `data-href`: se lo trova lo
considera già caricato. Per questo l'hydration (`resolveLazyMatches` importa il chunk della route) e la
navigazione client che torna sulla stessa route non riscaricano il CSS.

**Cosa è inline e cosa no:**

| Inline (CSS critico) | Non inline |
| --- | --- |
| `main`: `global.scss`, `utilities.scss` (le classi utility, vedi §9.3), `AppShell.module.scss`, `Header.module.scss` | `modal-login`: il `Modal.module.scss` della shell, chunk lazy (le utility di `LoginModal` sono già in `main`; `LoginModal` non ha un modulo) |
| `route-<x>`: il `Page.module.scss` della pagina (se esiste) e di ciò che la pagina importa staticamente | |

**Esempio guidato: "la pagina X ha una sezione pesante sotto la piega (galleria, mappa)".**

1. Se `pages/x/Page.tsx` importa `Gallery` in modo statico (`import { Gallery } from './Gallery.tsx'`),
   il `Gallery.module.scss` entra nel chunk `route-x` e quindi nel CSS inlinato di ogni richiesta a `/x`,
   anche se l'utente non scorre mai fin lì.
2. Per tenerlo fuori, falla diventare un componente lazy con il suo `.module.scss`: un wrapper leggero
   (importato staticamente, con solo un segnaposto di altezza riservata nel suo `.module.scss`) che fa
   `import(/* webpackChunkName: "gallery" */ './GalleryContent.tsx')` quando `useOnVisible` segnala che
   il segnaposto è vicino al viewport. Il `GalleryContent.module.scss` finisce nel chunk `gallery`,
   che si scarica (JS + CSS) solo allora.
3. Non serve registrare nulla: `npm run check:bundle` trova da solo ogni `import(/* webpackChunkName: "gallery" */ './GalleryContent.tsx')`
   con chunk non `route-` e fallisce se un import statico lo riporta in `main` o in `route-x`. Per
   aggiungere anche il controllo sulla stringa, esporta nel componente una costante `*_MARKER = '__GALLERY_CONTENT__'`,
   come `MODAL_MARKER` in `LoginModal.tsx`.
4. Il segnaposto è renderizzato dal server: se la sezione conta per la SEO, questo pattern non va bene
   (il contenuto non è nell'HTML). Per questo header e footer sono statici. Nel repo non c'è ancora un
   esempio di componente lazy al viewport: `useOnVisible` (`src/app/lazy/`) è pronto ma inutilizzato.

**Budget.** Il CSS inlinato (`main` + una route) dovrebbe stare nei circa 14 KB del primo round trip TCP.
`CRITICAL_CSS_BUDGET` in `assets.ts` vale 14 KB e, all'avvio, `readCriticalCss` scrive su `console.warn`
(`[portal] critical CSS of "route-x" is … bytes`) per ogni route che lo supera. È solo un avviso: il boot
non fallisce. Se lo vedi, sposta CSS in un chunk lazy come sopra.

**Compromessi.**

- Il CSS inlinato non entra nella cache del browser: viene rispedito a ogni pagina HTML. Va bene finché è
  piccolo (vedi il budget); oltre, conviene lasciarlo in un file linkato e cacheabile.
- In sviluppo non c'è inline (`getCriticalCss` restituisce `{}`): ci sono solo i `<link>`, quindi il
  comportamento del primo paint si verifica sulla build di produzione.

**Come verificarlo.**

1. `npm run build && npm run smoke`: i check sul CSS critico controllano che `/` inlini `main` e
   `route-home` e non linki nessun foglio di stile, che non ci sia CSS della modale, che
   `/annunci/1` inlini `route-listing`, che `/non-esiste` inlini solo `main` e che `main*.js` contenga
   `data-href` (se una versione futura del plugin perdesse la ricerca dello `<style>`, i file verrebbero
   riscaricati in silenzio: lo smoke lo segnala). Altri due check controllano che il CSS inlinato di
   `main` contenga le classi utility (`.p-3{`) e quello di `route-home` no (se qualcuno importasse
   `utilities.scss` da una pagina, finirebbe in ogni route).
2. In DevTools > Network (`npm start`), al primo caricamento di `/` non c'è nessuna richiesta
   `route-*.css` né `main*.css`.

### Stato e dati

- **Lo stato serializzato cresce con le pagine:** la whitelist `handle.slices` fa sì che si scrivano
  nell'HTML solo le slice della pagina corrente. Se aggiungi una slice e dimentichi di elencarla, la
  pagina non si idrata.
- **Cancella le richieste superate.** Il PoC non passa `request.signal` ai thunk: se l'utente cambia
  pagina mentre una fetch è in corso, la risposta vecchia può sovrascrivere quella nuova. In un'app
  vera: passa `request.signal` fino alla `fetch` e/o salva nello store la chiave della richiesta
  (id/query) e ignora le risposte non corrispondenti.
- **Aggiungi un timeout** alle fetch del browser: senza, un endpoint appeso lascia la navigazione in
  sospeso.
- **Cache:** il PoC non ne ha. Strati possibili, dal più semplice: `Cache-Control` per route (da
  mettere in `handle` e applicare in `render.tsx`), cache HTTP/CDN davanti a Express per le pagine
  anonime, cache in memoria nel service **solo** per dati non legati all'utente.

### Operatività

- **Il server è senza stato**: puoi lanciarne quanti ne vuoi dietro un load balancer.
- **Avvio:** `boot.ts` legge manifest e CSS all'avvio, quindi un build mancante fa fallire il boot, non la
  prima richiesta. Tienilo così.
- **Shutdown pulito** su SIGTERM già presente (`server.close` + timeout).
- **Test end-to-end** (Playwright): consigliati per la navigazione client e per i casi 404. Nel PoC le verifiche sono state fatte a mano.
- **Rspack:** la config è scritta per essere compatibile; se le build diventano lente è un cambio
  quasi a costo zero (non misurato).

### Cose che hanno già fatto danni (e perché sono scritte qui)

- **Una `Suspense` con `use(promise)` mai risolta nella shell** blocca *tutte* le navigazioni finché
  non si risolve: l'URL cambia ma la pagina no (era un tentativo di footer lazy con SSR e hydration
  differita, poi rimosso; ora il footer è statico). Dentro la shell, o dentro un componente che la shell
  ri-renderizza a ogni navigazione, non mettere boundary che restano "in attesa".
- **Creare lo store prima di caricare i chunk delle route** nel browser: le slice non ancora registrate
  perdono lo stato del server. L'ordine in `entry.tsx` è voluto.

---

## 11. Trappole note

| Cosa | Dettaglio |
| --- | --- |
| `dist/server` è condiviso tra `dev` e `build` | Il dev scrive lì `render.cjs`. Prima di `npm start` rifai `npm run build` |
| Il server non passa da webpack | Importa con estensione `.ts`, niente enum/JSX, e non importare `src/app/` da `src/server/` |
| Chrome DevTools chiama `/.well-known/appspecific/com.chrome.devtools.json` | Risponde 404 secco (`app.ts`), non serve rendere la shell |
| `Component: () => null` su `notFound` | Esiste solo per zittire il warning di React Router (il loader lancia sempre) |
| Una proprietà CSS sia in una utility sia nel modulo | Il CSS di route è inlinato dopo `main`: vince il modulo, la utility non ha effetto. Una proprietà, una sola fonte (§9.3) |
| `utilities.scss` importato fuori da `AppShell.tsx` | Il CSS delle utility viene duplicato nel CSS di ogni route |

---

## 12. Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | server di sviluppo su `localhost:3000` (`PORT=…` per cambiarla): HMR dei componenti; le modifiche a `src/server` o `build` riavviano il processo. Attenzione: `src/services/*` aggiorna l'SSR ma **non** l'API `/api/v1` (Express la importa a tempo di avvio): dopo aver cambiato un service riavvia `npm run dev` |
| `npm run build` | build di produzione in `dist/` |
| `npm start` | server di produzione (richiede la build) |
| `npm run check:bundle` | verifica che le parti lazy (modale, ...) siano fuori dal bundle iniziale |
| `npm run bundle:compare` | JS di primo caricamento per route vs merge-base, giudicato da `build/bundle-budget.json` (richiede la build) |
| `npm run analyze` | build + `dist/bundle-report.html` |
| `npm run typecheck` | `tsc --noEmit` |
