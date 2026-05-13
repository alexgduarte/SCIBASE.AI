const {
  CHALLENGE_VISIBILITY,
  IP_POLICIES,
  SUBMISSION_MODES,
  createBountyState,
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

const team = createTeam(state, {
  id: "team-1",
  name: "HydroLab",
  members: [
    { userId: "researcher-1", payoutAccount: "bank:researcher-1", sharePercent: 60 },
    { userId: "student-1", payoutAccount: "bank:student-1", sharePercent: 40 },
  ],
})

createMilestone(state, {
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
  milestonePhase: "proposal",
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
  path: "docs/whitepaper.md",
  kind: "document",
  content: "# Flood forecasting",
})

evaluateSubmission(state, {
  submissionId: submission.id,
  reviewerId: "reviewer-1",
  scores: { accuracy: 0.82, reproducibility: 0.95, clarity: 0.88 },
  feedback: "Strong model and reproducibility package.",
})

recordArbitrationDecision(state, {
  submissionId: submission.id,
  arbitratorId: "arbitrator-1",
  decision: "approved",
})

const payout = releaseMilestonePayout(state, {
  challengeId: challenge.id,
  submissionId: submission.id,
  phase: "proposal",
})

routePayouts(state, payout.id)

console.log(JSON.stringify({
  manifest: generateSubmissionManifest(state, submission.id),
  dashboard: getChallengeDashboard(state, challenge.id),
}, null, 2))
