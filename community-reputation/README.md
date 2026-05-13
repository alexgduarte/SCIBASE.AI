# Community and Reputation System

This module implements an MVP reference design for SCIBASE community, peer review, contribution credit, and reputation scoring workflows. It is dependency-free and can be run with Node.js.

## What This Provides

- Structured peer-review templates by discipline.
- Peer-review scoring for clarity, rigor, novelty, reproducibility, or other template criteria.
- Public, semi-private, and anonymous review modes.
- Inline comments on documents, datasets, code, and notebooks.
- Reviewer profile history and project timeline tracking.
- Contributor credit records using CRediT-style roles.
- Project contributor graph summaries.
- Visible credit records for researcher profiles and citation pages.
- Transparent reputation scoring from citations, forks, endorsements, reviews, comments, reproducibility checks, and bounty completions.
- Domain, region, and institution leaderboards.
- Badge assignment for trusted reviewers, reproducibility verifiers, bounty solvers, and open science champions.

## Layout

```text
community-reputation/
  demo/demo.js
  schema/community-reputation.schema.json
  src/communityReputation.js
  test/communityReputation.test.js
  requirements-map.md
```

## Run

```bash
npm test
npm run demo
```

No external services or packages are required.

## Example

```js
const {
  REVIEW_MODES,
  createCommunityState,
  createProject,
  createReviewTemplate,
  createUser,
  submitPeerReview,
} = require("./src/communityReputation")

const state = createCommunityState()
const reviewer = createUser(state, { id: "reviewer-1", name: "Dr. Reviewer" })
const author = createUser(state, { id: "author-1", name: "Dr. Author" })
const project = createProject(state, {
  id: "project-1",
  title: "Reproducible Study",
  ownerId: author.id,
})

const template = createReviewTemplate(state, {
  id: "biology",
  discipline: "biology",
  criteria: ["clarity", "rigor", "reproducibility"],
})

submitPeerReview(state, {
  projectId: project.id,
  reviewerId: reviewer.id,
  templateId: template.id,
  mode: REVIEW_MODES.public,
  scores: { clarity: 4, rigor: 5, reproducibility: 5 },
  summary: "Clear and reproducible.",
})
```

## Design Notes

This implementation keeps state in plain JavaScript objects so the incentive model is easy to review. A production backend can persist the same events in a database and compute leaderboard materializations asynchronously while keeping the scoring inputs auditable.
