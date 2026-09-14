# ADR 0005: No UI kit — hand-styled primitives on styled-components

**Status:** Accepted
**Date:** 2026-09-14 (written retroactively for step/1 — see Context)

## Context

Same retroactive situation as ADR 0004: this decision was implemented in
step/1 and used consistently ever since, but not written up until now, per
the same "keep it separate" call from step/2 planning.

`CLAUDE.md` §2 bans UI kits outright (MUI, Ant, Chakra, shadcn) and fixes
styled-components v6 with a `ThemeProvider` as the styling approach. The app
still has real UI surface needing this decision to hold up: a tree, an
analytical table, loading/error/empty states, a performance indicator, a
connection indicator, a search input — the kind of surface a normal project
would often reach for a component library to move through quickly.

## Decision

Every visual primitive is a small, purpose-built styled-component, hand-styled
against a single shared token file (`app/theme.ts`: color, spacing, radius,
duration, font size, breakpoints — see `CLAUDE.md` §8's "no magic numbers in
markup" rule, which this file is what call sites are meant to reference
instead). `shared/ui/` holds the handful of primitives reused across
features — `Spinner`, `EmptyState`, `ErrorMessage`, `PerformanceIndicator`
(the color-coded dot + numeric/aria-label pair used by both the tree and the
table) — each built for exactly what this app needs, not a general-purpose
prop API for cases the app doesn't have.

## Alternatives considered and rejected

- **MUI / Ant / Chakra / shadcn.** Banned by `CLAUDE.md` §2 directly. Beyond
  the spec: a full component library brings its own theming abstraction
  (component variant props, its own provider conventions) that would sit
  alongside — and partially duplicate — the project's own `theme.ts` +
  styled-components `ThemeProvider`, which §2 already fixes as *the*
  theming system. Two theming systems layered on each other is worse than
  either alone. There's also a portfolio-specific reason: assembling a UI
  kit's pre-built components is a different, narrower skill than building
  and reasoning about layout, state, and accessibility from scratch — for a
  codebase meant to be defended "out loud in under a minute" per §1's
  standard, the hand-built version is the more revealing evidence.
- **A headless primitives library** (Radix Primitives, Headless UI, React
  Aria) for just the interaction logic — focus management, roving tabindex,
  listbox semantics — while still hand-styling the visuals. A defensible
  middle ground in most projects, but rejected here specifically because the
  roving-tabindex mechanics built in step/3
  (`shared/hooks/useRovingIndex.ts`, ~70 lines, reused for both table
  headers and rows) are exactly the kind of "explainable in under a minute"
  mechanism `CLAUDE.md` §1 wants demonstrated firsthand — delegating it to a
  library the author didn't write defeats that purpose, and the surface area
  needed (one hook) is small enough that writing it isn't a real cost. Also
  still a new dependency requiring the same justification §2 demands for
  anything new, for a problem this small.
- **Tailwind CSS** instead of styled-components. `CLAUDE.md` §2 fixes
  styled-components with a `ThemeProvider` as a specific, deliberate choice
  — theme values (spacing, color, duration) are meant to be real JS values
  threaded through `props => props.theme.*`, not compiled utility classes
  resolved at build time. Switching would touch every component for a pure
  styling-methodology preference with no functional gain, and isn't what
  "no UI kit" is asking in the first place — Tailwind isn't a component
  library, just a different way to write CSS, so this alternative is really
  answering a different question than the one this ADR is about.

## Consequences

- Every primitive needed an explicit accessibility pass rather than
  inheriting one from a library's defaults: `PerformanceIndicator` carries
  an `aria-label` alongside its color (§8: "color is never the only carrier
  of meaning"), `Spinner`/`ErrorMessage`/`EmptyState` each needed their own
  live-region and semantic-role decisions made by hand. More code than a
  kit's `<Alert>`/`<Spinner>` would have needed, but every accessibility
  choice is visible in this repo, not inherited invisibly from a dependency.
- No structural consistency enforcement beyond `theme.ts` and code-review
  discipline — a component-library's props API (e.g. a fixed `size` enum)
  would have structurally prevented an arbitrary one-off value; here §8's
  "no magic numbers" rule is enforced by convention and review, not by a
  component refusing to accept anything else.
- Bundle size benefits, though this isn't the only contributor: 79.76 KB
  gzip against step/4's 200 KB budget, with no date library, no lodash, and
  no state manager also in the mix per §2. A UI kit, even tree-shaken,
  typically adds tens of KB on its own — avoiding one is meaningful but not
  the sole reason the budget has this much headroom.
- Any future interactive primitive with real complexity — a modal with focus
  trapping, a combobox, a date picker — will need to be built from scratch
  the same way `useRovingIndex` was, an ongoing cost of this decision rather
  than a one-time one.
