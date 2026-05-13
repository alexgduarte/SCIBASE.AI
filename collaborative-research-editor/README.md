# SCIBASE Collaborative Research Editor

Self-contained MVP module for issue `#12`, "Real-time collaborative research editor & interface".

The module models collaborative scientific documents with typed research blocks, deterministic edit operations, reviewer comments, suggestions, tasks, section locks, live presence, version snapshots, and publication-outline export metadata.

## Features

- Scientific block model for Markdown, LaTeX, code, notebook, data, figure, protocol, and metadata content.
- Deterministic operation application for block updates, insertions, deletions, and moves.
- Version snapshots with per-block content hashes after every accepted change.
- Section locks that prevent reviewers or collaborators from editing frozen sections owned by another actor.
- Inline comments, suggestions, task workflow, and accepted/open review item counts.
- Live collaborator presence with block-level cursor metadata.
- Publication outline export for downstream manuscript, review, or submission flows.

## Run

```powershell
npm.cmd test
npm.cmd run demo
```

No external dependencies are required.

## Intended Integration Path

This module is deliberately dependency-free so it can be reviewed as a domain/service layer first. A production UI can bind the exported functions to document panes, live cursor updates, autosave calls, and reviewer task surfaces without changing the core collaboration rules.
