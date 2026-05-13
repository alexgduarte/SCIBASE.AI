# Issue #16 Requirements Map

This file maps the AI-Powered Research Assistant Suite requirements to concrete artifacts.

## 1. Auto Peer Review Reports

- `createDomainReviewTemplate()` defines adaptive review templates per domain.
- `generatePeerReviewReport()` analyzes manuscripts, claims, and project metadata.
- Findings cover clarity, citations, statistical/methodological red flags, scope, and claims-vs-evidence alignment.
- Suggestions can be generated for author preflight or internal team review.

## 2. Reproducibility Checker

- `runReproducibilityCheck()` checks output consistency, dependency integrity, raw data presence, pipeline cleanliness, and test-set presence.
- Reproducibility attempts produce a confidence score.
- `linkReproducibilityAttempt()` records previous successful or failed attempts.
- Project files include data, code, notebooks, results, and dependency manifests.

## 3. Research Gap Finder

- `createProjectCorpus()` registers published and in-progress research metadata.
- `scanResearchGaps()` identifies under-studied intersections, low replication, negative results, limitations, and high citation pressure.
- `createResearcherProfile()` stores interests, project history, and lab capabilities.
- `generateResearchOpportunityFeed()` ranks opportunity recommendations by interest and capability fit.

## Validation

Run from `research-assistant-suite/`:

```bash
npm test
npm run demo
```
