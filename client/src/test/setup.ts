import '@testing-library/jest-dom/vitest'

// jsdom has no layout engine, so scrollIntoView is unimplemented — the tree's
// reveal-on-select effect calls it, and component tests need it stubbed.
Element.prototype.scrollIntoView ??= () => {}
