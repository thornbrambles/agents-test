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

### Dynamic DAGs

A node can carry a `spawns` rule: once it finishes, it deterministically picks
one weighted outcome (seeded by a run seed + that node's id) and splices the
outcome's nodes into the graph as its dependents — modeling a task whose
result decides what work appears next. The seed makes the choice depend only
on `(seed, nodeId)`, never on execution order or timing, so Beads and Actors
always face the *identical* sequence of dynamic decisions even though they
discover and run nodes differently — the comparison stays fair. Try the
"Dynamic: flaky pipeline" preset, where `Run tests` spawns either `Deploy` or
a `Debug failure → Re-run tests` chain.

### Jobs vs. agents

A node can be marked `kind: "agent"` (default is `"job"`) to model an LLM
call instead of deterministic work. All agent nodes share one concurrency
limit — a stand-in for an API rate limit — that's independent of the
worker-pool size (Beads) or the concurrency cap (Actors); `job` nodes are
never throttled by it. This is the more realistic constraint once a "bead" or
"actor" is an LLM agent rather than a deterministic task: the bottleneck
stops being how many workers/actors you have and becomes the shared rate
limit both scheduling styles have to respect equally. Try "Mixed: jobs + LLM
agents" — with the limit at 2, only 2 of the 4 agent calls run at a time
under *either* scheduler, while the independent `format` job runs immediately,
unaffected.

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
