const assert = require("assert")

const {
  CHALLENGE_VISIBILITY,
  IP_POLICIES,
  MILESTONE_STATUS,
  PAYOUT_STATUS,
  SUBMISSION_MODES,
  createChallenge,
  createMilestone,
  createSponsor,
  createSubmission,
  createTeam,
  createWorkspaceArtifact,
  evaluateSubmission,
  generateSubmissionManifest,
  getChallengeDashboard,
  recordArbitrationDecision,
  releaseMilestonePayout,
  routePayouts,
  createBountyState,
} = require("../src/scientificBountySystem")

const state = createBountyState()

const sponsor = createSponsor(state, {
  id: "sponsor-1",
  name: "Climate Futures Foundation",
  organizationType: "nonprofit",
  payoutAccount: "escrow:climate-futures",
})

const challenge = createChallenge(state, {
  id: "challenge-1",
  sponsorId: sponsor.id,
  title: "Regional Flood Forecasting Model",
  vertical: "climate",
  visibility: CHALLENGE_VISIBILITY.public,
  problemDescription: "Build a reproducible regional flood forecasting model.",
  scientificContext: "Forecasts must combine public rainfall, river gauge, and land-use data.",
  deliverables: ["working model", "dataset", "whitepaper"],
  evaluationCriteria: [
    { name: "accuracy", weight: 0.45 },
    { name: "reproducibility", weight: 0.35 },
    { name: "clarity", weight: 0.2 },
  ],
  timeline: {
    proposalDue: "2026-06-01T00:00:00.000Z",
    prototypeDue: "2026-07-01T00:00:00.000Z",
    finalDue: "2026-08-01T00:00:00.000Z",
  },
  prizeAmountCents: 100000,
  payoutSchedule: [
    { phase: "proposal", percent: 20 },
    { phase: "prototype", percent: 30 },
    { phase: "final", percent: 50 },
  ],
  templates: ["climate", "ML"],
  preQualificationRequired: true,
  ndaRequired: false,
  ipPolicy: IP_POLICIES.solverRetainsUntilPaid,
})

assert.strictEqual(challenge.escrow.amountCents, 100000)
assert.strictEqual(challenge.evaluationRubric.totalWeight, 1)
assert.strictEqual(challenge.payoutSchedule[2].amountCents, 50000)

const team = createTeam(state, {
  id: "team-1",
  name: "HydroLab",
  members: [
    { userId: "researcher-1", payoutAccount: "bank:researcher-1", sharePercent: 60 },
    { userId: "student-1", payoutAccount: "bank:student-1", sharePercent: 40 },
  ],
  institutions: ["Open University"],
})

const proposalMilestone = createMilestone(state, {
  challengeId: challenge.id,
  phase: "proposal",
  dueAt: "2026-06-01T00:00:00.000Z",
  deliverables: ["whitepaper"],
})

const submission = createSubmission(state, {
  id: "submission-1",
  challengeId: challenge.id,
  teamId: team.id,
  mode: SUBMISSION_MODES.named,
  milestonePhase: proposalMilestone.phase,
  title: "Probabilistic flood forecasting with public gauge data",
})

createWorkspaceArtifact(state, {
  submissionId: submission.id,
  path: "data/river-gauges.csv",
  kind: "dataset",
  content: "station,rainfall,level\nA,12.4,2.1",
})
createWorkspaceArtifact(state, {
  submissionId: submission.id,
  path: "code/train_model.py",
  kind: "code",
  content: "print('train')",
})
createWorkspaceArtifact(state, {
  submissionId: submission.id,
  path: "notebooks/evaluation.ipynb",
  kind: "notebook",
  content: "{}",
})
createWorkspaceArtifact(state, {
  submissionId: submission.id,
  path: "docs/whitepaper.md",
  kind: "document",
  content: "# Flood forecasting",
})

const manifest = generateSubmissionManifest(state, submission.id)
assert.strictEqual(manifest.deliverablesComplete, true)
assert.ok(manifest.artifacts.every((artifact) => artifact.contentHash))
assert.ok(manifest.auditLog.some((entry) => entry.action === "artifact.created"))

const evaluation = evaluateSubmission(state, {
  submissionId: submission.id,
  reviewerId: "reviewer-1",
  scores: {
    accuracy: 0.82,
    reproducibility: 0.95,
    clarity: 0.88,
  },
  feedback: "Strong model and reproducibility package.",
})

assert.strictEqual(evaluation.weightedScore, 0.877)
assert.strictEqual(submission.status, "evaluated")

const arbitration = recordArbitrationDecision(state, {
  submissionId: submission.id,
  arbitratorId: "arbitrator-1",
  decision: "approved",
  notes: "Deliverables satisfy proposal milestone.",
})

assert.strictEqual(arbitration.decision, "approved")
assert.strictEqual(submission.arbitration.status, "approved")

const payout = releaseMilestonePayout(state, {
  challengeId: challenge.id,
  submissionId: submission.id,
  phase: "proposal",
})

assert.strictEqual(payout.status, PAYOUT_STATUS.ready)
assert.strictEqual(payout.amountCents, 20000)
assert.strictEqual(proposalMilestone.status, MILESTONE_STATUS.paid)
assert.strictEqual(submission.ipTransfer.status, "licensed-after-payout")

const routed = routePayouts(state, payout.id)
assert.deepStrictEqual(routed.routes.map((route) => route.amountCents), [12000, 8000])
assert.strictEqual(routed.status, PAYOUT_STATUS.routed)

const dashboard = getChallengeDashboard(state, challenge.id)
assert.strictEqual(dashboard.challenge.title, "Regional Flood Forecasting Model")
assert.strictEqual(dashboard.submissions.length, 1)
assert.strictEqual(dashboard.submissions[0].manifest.deliverablesComplete, true)
assert.strictEqual(dashboard.payouts[0].status, PAYOUT_STATUS.routed)
assert.ok(dashboard.timeline.some((entry) => entry.action === "payout.routed"))

console.log("scientific bounty system tests passed")
