# ICS Today

A single-page app that fetches an ICS calendar feed from a URL and displays it in a week or day view. CORS is handled by a Cloudflare Worker proxy.

## Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Full URL to an ICS file or feed. Must be a valid absolute URL (`https://...`). |

**Example:**
```
https://ics-today.pages.dev/?url=https://example.com/calendar.ics
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

`dev-assets/calendar.ics` is served at `/assets/calendar.ics` by the dev server (same origin, no CORS proxy needed). `environment.ts` sets `proxyUrl: ''` so the production worker is never called during development.

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
npm run build
npx wrangler pages deploy --project-name ics-today
```cd worker
npx wrangler deploy

Wrangler reads the output directory from `wrangler.toml` (`dist/ics-today/browser`). The Pages URL is printed after deploy.

## Project structure

```
worker/
  index.js        # Cloudflare Worker — CORS proxy
  wrangler.toml   # Worker deploy config
src/
  environments/
    environment.ts       # dev: proxy URL
    environment.prod.ts  # prod: proxy URL (swapped in at build time)
wrangler.toml     # Pages deploy config (pages_build_output_dir)
```
