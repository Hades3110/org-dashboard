// Lives in the feature (not `app`) so both `AiSearchInput` (features) and
// `useAiSearch` (app) can import it — `app → features` is allowed,
// `features → app` is not (CLAUDE.md §3).
export type AiSearchStatus = 'idle' | 'thinking' | 'ai' | 'fallback'
