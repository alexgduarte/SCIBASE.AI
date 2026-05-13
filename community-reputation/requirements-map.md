# Issue #15 Requirements Map

This file maps the Community and User Reputation System bounty requirements to concrete artifacts.

## 1. Peer Reviews and Comments

- `createReviewTemplate()` creates discipline-specific review templates.
- `submitPeerReview()` records structured peer reviews with optional scoring.
- `REVIEW_MODES` supports public, semi-private, and anonymous review modes.
- `recordInlineComment()` supports comments on documents, datasets, code, and notebooks.
- `getUserProfile()` exposes reviewer history.
- `getProjectTimeline()` exposes project review/comment history.

## 2. Contributor Credits

- `recordContribution()` logs timestamped contributions.
- `CREDIT_ROLES` includes CRediT-style contributor roles.
- `summarizeContributorGraph()` builds a Git-style contributor graph for each project.
- `getUserProfile()` exposes visible credits and citation-page entries.

## 3. Reputation Scoring

- `recordCitation()` and `recordFork()` track project impact.
- `grantEndorsement()` tracks endorsements from researchers.
- `submitPeerReview()` updates peer review count and quality metrics.
- `recordReproducibilityVerification()` tracks reproducibility badges.
- `recordBountyCompletion()` tracks scientific bounty and challenge performance.
- `listLeaderboard()` ranks users by domain, region, and institution.
- `createBadgeCatalog()` and `updateUserRecognition()` assign incentive badges.

## Validation

Run from `community-reputation/`:

```bash
npm test
npm run demo
```
