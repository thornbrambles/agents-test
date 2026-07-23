# Beads vs Actors: DAG task execution

A small interactive playground for comparing two ways of scheduling a DAG of
tasks:

- **Beads-style**: a shared "ready" queue (`blocked -> ready -> done`) pulled
  by a fixed pool of workers — the way [Beads](https://github.com/steveyegge/beads)
  tracks dependency-linked issues and a human/agent team works through them.
- **Actor-style**: every node is an independent actor that reacts the instant
  its dependencies' "done" messages have all arrived, then broadcasts its own
  completion. No shared queue — parallelism falls straight out of the
  dependency graph.

Define a DAG (or pick a preset), run it both ways, and compare the resulting
Gantt-style timelines and total wall-clock time.

## Local development

```bash
npm install
npm run dev
```

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds the site and deploys it automatically.

## Setting up "Sign in with GitHub"

GitHub Pages only serves static files, and GitHub's OAuth Device Flow token
endpoint doesn't send CORS headers — so a pure static page can't poll it
directly. This repo routes just that one step through a tiny, secret-free
proxy you deploy yourself:

1. **Create a GitHub OAuth App**: Settings → Developer settings → OAuth Apps →
   New OAuth App. Any homepage URL works. Check **"Enable Device Flow"**.
   Copy the **Client ID** (this is not secret and is safe to put in a static
   site — device flow never uses the client secret).
2. **Deploy the token proxy**: [`worker/token-proxy.js`](worker/token-proxy.js)
   is a Cloudflare Worker that only adds CORS headers to two GitHub endpoints
   — it holds no secrets and needs no configuration.
   ```bash
   npx wrangler login
   npx wrangler deploy worker/token-proxy.js --name dag-demo-token-proxy
   ```
   Note the `*.workers.dev` URL it prints.
3. **Configure the site**: open the deployed page, click **Sign in with
   GitHub** → **Settings**, and paste in the OAuth App's Client ID and the
   worker URL. These are stored in your browser's `localStorage` only.

If you'd rather skip this, the demo works fully without signing in — auth
just gates nothing in particular here, it's there to demonstrate the pattern.

## Project layout

```
src/dag/       DAG data model, presets, cycle/reference validation
src/exec/      the two schedulers: beads.ts (shared queue) and actors.ts (reactive)
src/auth/      GitHub OAuth Device Flow client
src/ui/        DOM wiring for the editor, timelines, and auth panel
worker/        Cloudflare Worker CORS proxy for the device-flow token endpoint
```
