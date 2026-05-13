# AI-Powered Research Assistant Suite

This module implements an MVP reference design for SCIBASE research-assistant workflows: automated peer-review reports, reproducibility checking, and research-gap discovery. It is dependency-free and can be run with Node.js.

## What This Provides

- Domain-specific review templates for molecular biology, quantum physics, clinical trials, and general projects.
- Structured peer-review suggestions for clarity, methodology, citations, claims-vs-evidence, and reproducibility.
- Rule-based red-flag detection for missing statistical support, missing citations, and other domain checks.
- Reproducibility checks for output consistency, dependency integrity, raw data presence, pipeline cleanliness, and test-set presence.
- Confidence scores and linked prior reproducibility attempts.
- Corpus scanning for high-citation unresolved intersections, low-replication areas, negative results, and limitations.
- Personalized research opportunity feeds based on researcher interests, project history, and lab capabilities.

## Layout

```text
research-assistant-suite/
  demo/demo.js
  schema/research-assistant-suite.schema.json
  src/researchAssistantSuite.js
  test/researchAssistantSuite.test.js
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
  ASSISTANT_DOMAINS,
  createAssistantState,
  createDomainReviewTemplate,
  generatePeerReviewReport,
  registerProject,
} = require("./src/researchAssistantSuite")

const state = createAssistantState()
createDomainReviewTemplate(state, {
  domain: ASSISTANT_DOMAINS.molecularBiology,
  criteria: ["clarity", "methodology", "citations"],
})

registerProject(state, {
  id: "project-1",
  title: "Biomarker Study",
  domain: ASSISTANT_DOMAINS.molecularBiology,
  manuscript: "The treatment effect is significant at p < 0.05.",
  files: { "data/cohort.csv": "sample,marker" },
})

generatePeerReviewReport(state, {
  projectId: "project-1",
  audience: "author-preflight",
})
```

## Design Notes

This MVP uses deterministic rules and corpus metadata so the behavior is auditable. A production system can replace or augment the rule engine with model-backed analysis while keeping the same report, reproducibility, and opportunity-feed contracts.
