# Issue #18 Requirements Map

This file maps the Scientific Bounty System requirements to concrete artifacts.

## 1. Challenge Posting Portal

- `createChallenge()` records problem description, scientific context, deliverables, evaluation criteria, deadlines, prize amount, and payout schedule.
- `CHALLENGE_VISIBILITY` supports public and private challenges.
- Challenge metadata includes pre-qualification and NDA flags.
- `templates` supports R&D verticals such as biotech, materials, climate, ML, and chemistry.
- `normalizeRubric()` validates scoring weights.

## 2. Submission Engine

- `createSubmission()` creates a private submission workspace for each team.
- Submission workspaces include code, data, documents, notebooks, execution tools, and audit logs.
- `createWorkspaceArtifact()` records versioned artifacts with content hashes.
- `generateSubmissionManifest()` creates a standardized package manifest.
- `SUBMISSION_MODES` supports named and anonymous participation.
- `createMilestone()` supports multi-phase challenges.

## 3. Arbitration and Reward Distribution

- `evaluateSubmission()` applies weighted review scores and feedback.
- `recordArbitrationDecision()` records platform-mediated approval decisions.
- `releaseMilestonePayout()` releases escrowed partial milestone rewards.
- `routePayouts()` splits payouts across individual team members.
- `IP_POLICIES` models solver-retains-until-paid, sponsored transfer, and open-source policies.
- `getChallengeDashboard()` exposes sponsor-facing submissions, manifests, evaluations, arbitration, milestones, payouts, and timeline events.

## Validation

Run from `scientific-bounty-system/`:

```bash
npm test
npm run demo
```
