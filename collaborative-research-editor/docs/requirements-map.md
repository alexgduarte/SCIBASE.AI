# Requirements Map

Issue `#12`: Real-time collaborative research editor & interface.

## Scientific Document Blocks

- `createResearchDocument` stores typed scientific blocks for Markdown, LaTeX, code, notebook, data, figure, protocol, and metadata content.
- `validateBlock` rejects unsupported block types so exported publication data remains predictable.

## Real-Time Operations

- `applyOperation` supports block update, insert, delete, and move operations.
- `setPresence` tracks active collaborators and cursor metadata at block granularity.
- Every accepted operation appends a version snapshot with block hashes for auditability.

## Comments, Suggestions, And Tasks

- `addComment` attaches reviewer comments to specific blocks.
- `addSuggestion` and `resolveSuggestion` model suggested revisions and accepted/rejected outcomes.
- `createTask` adds block-scoped follow-up work with optional due dates.

## Section Locks And Review Safety

- `lockSection` freezes a section for review.
- `applyOperation` blocks edits from other actors while a section lock is active.

## Publication Export

- `exportPublicationOutline` returns ordered sections, block content hashes, collaborators, latest version, and review item counts.
- `summarizeCollaborationState` gives a compact dashboard payload for reviewers and product surfaces.

## Validation

- `test/collaborativeResearchEditor.test.js` covers document creation, edit history, section locks, comments, suggestions, tasks, presence, and export summaries.
- `demo/demo.js` prints a realistic collaboration state and publication outline.
