# Org Dashboard

Monitoring dashboard for a company's organisational structure (divisions →
departments → teams): an interactive tree and, from step/2 on, an analytical
table with subtree rollups.

Status: **step/1 — Foundation** (scaffold, mock API, cache layer, interactive
tree). See [CLAUDE.md](CLAUDE.md) for the full spec and milestone breakdown.

## Quick start

```bash
npm install
npm run dev
```

This starts the API server on `http://localhost:3001` and the client on
`http://localhost:5173` (client dev requests to `/api/*` are proxied to the
server — see `client/vite.config.ts`).

Other commands (run from the repo root, applied across both workspaces where
relevant):

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Mock API debug switches

`GET /api/org-tree` supports query parameters for exercising each UI state
manually:

| Query | Effect |
|---|---|
| `?scenario=empty` | Returns `[]` |
| `?scenario=error` | Returns `500` |
| `?scenario=invalid` | Returns a payload that fails client-side schema validation |
| `?delay=5000` | Delays the response by the given number of milliseconds |

## AI in development

This project was built with AI assistance (Claude Code) throughout. A running,
honest log of what was generated, what was rewritten by hand, and why lives in
[docs/ai-log.md](docs/ai-log.md) — updated at the end of every work session.
