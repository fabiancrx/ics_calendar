# ICS Today

A single-page app that fetches an ICS calendar feed from a URL and displays it in month, week, day, or list view. CORS is handled by a Cloudflare Worker proxy that also normalizes Windows timezone IDs (used by Exchange/Outlook) to IANA names.

## Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Full URL to an ICS file or feed. Must be a valid absolute URL (`https://...`). |
| `view` | No | Initial view: `month`, `week`, `day`, or `list`. Defaults to `day`. |

Both parameters are persisted in `localStorage` and restored automatically on the next visit if absent from the URL.

**Example:**
```
https://ics-today.pages.dev/?url=https://example.com/calendar.ics&view=week
```

## Develop

**Prerequisites:** Node.js 22+, Angular CLI 21+, [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install
ng serve
```

Open the app with the local dev fixture:

```
http://localhost:4200/?url=http://localhost:4200/assets/calendar.ics
```

`public/assets/calendar.ics` is served at `/assets/calendar.ics` by the dev server (same origin, no CORS proxy needed). `environment.ts` sets `proxyUrl: ''` so the production worker is never called during development.

To test against an external ICS URL locally, run `cd worker && npx wrangler dev` and set `proxyUrl: 'http://localhost:8787'` in `src/environments/environment.ts`.

## Deploy

### 1. Deploy the CORS proxy worker (first time only)

```bash
cd worker
npx wrangler deploy
```

This publishes the worker to `https://ics-proxy.croxx5f.workers.dev`.

### 2. Build and deploy the app to Cloudflare Pages

```bash
npm run deploy
```

Wrangler reads the output directory from `wrangler.toml` (`dist/ics-today/browser`). The Pages URL is printed after deploy.

## Project structure

```
worker/
  index.js        # Cloudflare Worker — CORS proxy + Windows timezone normalization
  wrangler.toml   # Worker deploy config
public/
  assets/
    calendar.ics  # Local dev fixture (not used in production)
src/
  environments/
    environment.ts       # dev: empty proxyUrl, localhost defaultUrl
    environment.prod.ts  # prod: proxyUrl set, no defaultUrl (swapped in at build time)
wrangler.toml     # Pages deploy config (pages_build_output_dir)
```
