# Architecture

## Layers

```
api            http client, ETag-aware cache layer, org-tree fetcher
  ↓
entities/org   zod schema, flat→tree builder, aggregation (pure TS, no React)
  ↓
features/      org-tree (tree view), org-table (analytical table)
  ↓
app            OrgDashboard — the only place that composes both features
```

Dependency direction is one-way: `features → entities → shared`, never the
reverse, and never feature → feature. `entities/org` stays pure TypeScript —
no React import — which is exactly why `aggregate.ts` and `buildTree.ts` are
unit-testable without a DOM.

## Data flow: fetch → build → aggregate

`app/OrgDashboard.tsx` is the single composition root and the only component
that calls `useCachedResource`. Everything downstream is prop-driven:

1. `useCachedResource(ORG_TREE_CACHE_KEY, fetchOrgTree, { staleTime: 5000 })`
   returns the flat `OrgNodeDto[]` (§6 of `CLAUDE.md`).
2. `buildOrgTree(nodes)` — a two-pass builder — turns the flat array into
   `OrgTreeNode[]` (roots with nested `children`). Memoised on `nodes`.
3. `aggregateOrgTree(roots)` — one post-order DFS — returns
   `Map<string, OrgAggregateRow>`, one entry per node, each carrying the
   node's own subtree `Aggregate` (sums), its 1-based `level`, and its
   root-first `ancestors` path. Memoised on `roots`.

Both memos key off the reference the cache layer hands back. A `304` response
keeps that reference identical (§6), so an unchanged poll skips `buildOrgTree`
*and* `aggregateOrgTree` entirely — not just one view's share of the work.

`OrgTree` and `OrgTable` never fetch, build, or aggregate themselves; they
receive `roots` / the row list as props and render.

## State ownership

| State | Owner | Why |
|---|---|---|
| Fetched data, loading/error/empty | `OrgDashboard` | Single fetch, shared by both views |
| `roots`, `aggregates` (memoised) | `OrgDashboard` | Computed once, consumed by both views |
| `selectedId`, `revealToken` | `OrgDashboard` | Cross-feature — a table row click must affect the tree |
| `viewMode` ('tree' \| 'table') | `OrgDashboard` | Drives which panel is visible below the split breakpoint |
| Expansion state, node DOM refs | `org-tree` (`useTreeExpansion`, `OrgTree`) | Nothing outside the tree needs it |
| Sort column/direction, filter text | `org-table` (`useSortState`, `OrgTable`) | Nothing outside the table needs it |

`org-table` never imports from `org-tree` or vice versa — the only thing that
imports both is `app/OrgDashboard.tsx`. This is why cross-feature state lives
in `app`, not in a `features/org-dashboard`: a feature-level composition would
make one feature import the other, which `CLAUDE.md` §3 forbids outright.

## Split view (tree/table switch, ≥1280px)

CSS-only: `theme.breakpoints.split` (`1280px`) drives a styled-components
media query in `OrgDashboard.styles.ts`. Both `OrgTree` and `OrgTable` stay
mounted in the DOM at all times — only their CSS `display` toggles between
`none` (inactive panel, narrow viewport) and `block`/`grid` (active panel, or
any width ≥1280px, where both are always shown). `ViewSwitch` itself is
hidden above the breakpoint, since it would otherwise imply a choice that no
longer exists.

Keeping both panels mounted, rather than conditionally rendering one, means
tree-expansion state and table sort/filter state survive both a window resize
and the user flipping the switch — with no `matchMedia` subscription/listener
to set up or clean up. The trade-off: `jsdom` doesn't evaluate real media
queries, so the pixel breakpoint itself is verified manually (browser resize),
not by a unit test — component tests assert the underlying prop wiring
instead.

## Reveal-in-tree (table → tree sync)

A table row click sets `selectedId` and increments `revealToken` in
`OrgDashboard`. `OrgTree` receives `selectedId`, `revealAncestorIds` (read
straight off `aggregates.get(selectedId).ancestors` — no second tree walk),
and `revealToken`, and runs two effects:

1. **Expand** — `expandAncestors(revealAncestorIds)` unions the ancestor ids
   into the expansion `Set` in one batched update (a no-op, same `Set`
   reference, if they're already expanded).
2. **Scroll** — looks up the selected node's `<li>` in a ref map
   (`registerNode`, populated via callback refs on every `TreeNode`) and calls
   `scrollIntoView`.

These are two separate effects, not one, because `setExpanded` in step 1 is
asynchronous: the target `<li>` only exists in the DOM once the resulting
re-render commits. Effect 2 depends on `isExpanded`'s identity rather than an
empty array — that identity is recreated exactly when the expansion `Set`
changes (see `useTreeExpansion`), so it's a reliable "the DOM may have just
changed, check again" trigger. A `useRef` guard (`lastRevealed`) stops it from
re-scrolling on unrelated re-renders once a given `(selectedId, revealToken)`
pair has already been handled.

## Formatting and sorting contracts

See `docs/data-model.md` for the `Aggregate`/`OrgAggregateRow` shapes, the
`avgPerformance` null rule, and the sort/format contracts in detail.
