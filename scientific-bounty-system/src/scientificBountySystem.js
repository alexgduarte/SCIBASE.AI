const crypto = require("crypto")

const CHALLENGE_VISIBILITY = {
  public: "public",
  private: "private",
}

const SUBMISSION_MODES = {
  named: "named",
  anonymous: "anonymous",
}

const IP_POLICIES = {
  solverRetainsUntilPaid: "solver-retains-until-paid",
  sponsoredTransferOnPayout: "sponsored-transfer-on-payout",
  openSource: "open-source",
}

const MILESTONE_STATUS = {
  open: "open",
  submitted: "submitted",
  approved: "approved",
  paid: "paid",
}

const PAYOUT_STATUS = {
  ready: "ready",
  routed: "routed",
}

function createBountyState() {
  return {
    sponsors: {},
    challenges: {},
    teams: {},
    submissions: {},
    milestones: {},
    payouts: {},
    timeline: [],
    counters: {
      milestones: 1,
      payouts: 1,
      evaluations: 1,
      arbitration: 1,
      timeline: 1,
    },
  }
}

function createSponsor(state, input) {
  const id = requiredString(input.id, "id")
  const sponsor = {
    id,
    name: requiredString(input.name, "name"),
    organizationType: requiredString(input.organizationType, "organizationType"),
    payoutAccount: requiredString(input.payoutAccount, "payoutAccount"),
    createdAt: timestamp(),
  }
  state.sponsors[id] = sponsor
  appendTimeline(state, "sponsor.created", id, { sponsorId: id })
  return sponsor
}

function createChallenge(state, input) {
  const sponsor = requireSponsor(state, input.sponsorId)
  const evaluationRubric = normalizeRubric(input.evaluationCriteria)
  const prizeAmountCents = requiredNumber(input.prizeAmountCents, "prizeAmountCents")
  const id = requiredString(input.id, "id")
  const challenge = {
    id,
    sponsorId: sponsor.id,
    title: requiredString(input.title, "title"),
    vertical: requiredString(input.vertical, "vertical"),
    visibility: requiredEnum(input.visibility, CHALLENGE_VISIBILITY, "visibility"),
    problemDescription: requiredString(input.problemDescription, "problemDescription"),
    scientificContext: requiredString(input.scientificContext, "scientificContext"),
    deliverables: requiredArray(input.deliverables, "deliverables"),
    evaluationRubric,
    timeline: input.timeline || {},
    prizeAmountCents,
    payoutSchedule: normalizePayoutSchedule(input.payoutSchedule, prizeAmountCents),
    templates: input.templates || [],
    preQualificationRequired: Boolean(input.preQualificationRequired),
    ndaRequired: Boolean(input.ndaRequired),
    ipPolicy: requiredEnum(input.ipPolicy, IP_POLICIES, "ipPolicy"),
    escrow: {
      sponsorId: sponsor.id,
      amountCents: prizeAmountCents,
      status: "funded",
      account: sponsor.payoutAccount,
    },
    submissions: [],
    milestones: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.challenges[id] = challenge
  appendTimeline(state, "challenge.created", sponsor.id, { challengeId: id, prizeAmountCents })
  return challenge
}

function createTeam(state, input) {
  const id = requiredString(input.id, "id")
  const members = requiredArray(input.members, "members")
  const shareTotal = members.reduce((sum, member) => sum + requiredNumber(member.sharePercent, "sharePercent"), 0)
  if (shareTotal !== 100) {
    throw new Error("Team payout shares must total 100")
  }
  const team = {
    id,
    name: requiredString(input.name, "name"),
    members: members.map((member) => ({
      userId: requiredString(member.userId, "userId"),
      payoutAccount: requiredString(member.payoutAccount, "payoutAccount"),
      sharePercent: member.sharePercent,
    })),
    institutions: input.institutions || [],
    createdAt: timestamp(),
  }
  state.teams[id] = team
  appendTimeline(state, "team.created", id, { teamId: id })
  return team
}

function createMilestone(state, input) {
  const challenge = requireChallenge(state, input.challengeId)
  const milestone = {
    id: `milestone-${state.counters.milestones++}`,
    challengeId: challenge.id,
    phase: requiredString(input.phase, "phase"),
    dueAt: requiredString(input.dueAt, "dueAt"),
    deliverables: requiredArray(input.deliverables, "deliverables"),
    status: MILESTONE_STATUS.open,
    createdAt: timestamp(),
  }
  state.milestones[milestone.id] = milestone
  challenge.milestones.push(milestone.id)
  appendTimeline(state, "milestone.created", challenge.sponsorId, {
    challengeId: challenge.id,
    phase: milestone.phase,
  })
  return milestone
}

function createSubmission(state, input) {
  const challenge = requireChallenge(state, input.challengeId)
  const team = requireTeam(state, input.teamId)
  const id = requiredString(input.id, "id")
  const submission = {
    id,
    challengeId: challenge.id,
    teamId: team.id,
    mode: requiredEnum(input.mode, SUBMISSION_MODES, "mode"),
    publicTeamId: input.mode === SUBMISSION_MODES.anonymous ? "anonymous" : team.id,
    milestonePhase: requiredString(input.milestonePhase, "milestonePhase"),
    title: requiredString(input.title, "title"),
    status: "draft",
    workspace: {
      artifacts: {},
      auditLog: [],
      tools: ["code", "data", "documents", "notebooks", "execution"],
    },
    evaluations: [],
    arbitration: {
      status: "pending",
      decisions: [],
    },
    ipTransfer: {
      policy: challenge.ipPolicy,
      status: "solver-retains-ip",
    },
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.submissions[id] = submission
  challenge.submissions.push(id)
  appendWorkspaceAudit(submission, "submission.created", team.id, { challengeId: challenge.id })
  appendTimeline(state, "submission.created", team.id, { challengeId: challenge.id, submissionId: id })
  return submission
}

function createWorkspaceArtifact(state, input) {
  const submission = requireSubmission(state, input.submissionId)
  const artifact = {
    path: requiredString(input.path, "path"),
    kind: requiredString(input.kind, "kind"),
    contentHash: hashContent(input.content),
    createdAt: timestamp(),
  }
  submission.workspace.artifacts[artifact.path] = artifact
  submission.status = "submitted"
  submission.updatedAt = timestamp()
  appendWorkspaceAudit(submission, "artifact.created", submission.teamId, {
    path: artifact.path,
    kind: artifact.kind,
    contentHash: artifact.contentHash,
  })
  return artifact
}

function generateSubmissionManifest(state, submissionId) {
  const submission = requireSubmission(state, submissionId)
  const challenge = requireChallenge(state, submission.challengeId)
  const artifacts = Object.values(submission.workspace.artifacts)
  const deliverablesComplete = challenge.deliverables.every((deliverable) => artifactSatisfiesDeliverable(artifacts, deliverable))
  return {
    submissionId: submission.id,
    challengeId: challenge.id,
    title: submission.title,
    deliverables: challenge.deliverables,
    deliverablesComplete,
    artifacts,
    auditLog: submission.workspace.auditLog,
    generatedAt: timestamp(),
    manifestHash: hashContent({ artifacts, auditLog: submission.workspace.auditLog }),
  }
}

function evaluateSubmission(state, input) {
  const submission = requireSubmission(state, input.submissionId)
  const challenge = requireChallenge(state, submission.challengeId)
  const scores = input.scores || {}
  const weightedScore = floor3(
    challenge.evaluationRubric.criteria.reduce((sum, criterion) => {
      if (typeof scores[criterion.name] !== "number") {
        throw new Error(`Missing score: ${criterion.name}`)
      }
      return sum + scores[criterion.name] * criterion.weight
    }, 0),
  )
  const evaluation = {
    id: `evaluation-${state.counters.evaluations++}`,
    reviewerId: requiredString(input.reviewerId, "reviewerId"),
    scores,
    weightedScore,
    feedback: input.feedback || "",
    createdAt: timestamp(),
  }
  submission.evaluations.push(evaluation)
  submission.status = "evaluated"
  appendWorkspaceAudit(submission, "submission.evaluated", evaluation.reviewerId, {
    evaluationId: evaluation.id,
    weightedScore,
  })
  appendTimeline(state, "submission.evaluated", evaluation.reviewerId, {
    challengeId: challenge.id,
    submissionId: submission.id,
    weightedScore,
  })
  return evaluation
}

function recordArbitrationDecision(state, input) {
  const submission = requireSubmission(state, input.submissionId)
  const challenge = requireChallenge(state, submission.challengeId)
  const decision = {
    id: `arbitration-${state.counters.arbitration++}`,
    arbitratorId: requiredString(input.arbitratorId, "arbitratorId"),
    decision: requiredString(input.decision, "decision"),
    notes: input.notes || "",
    createdAt: timestamp(),
  }
  submission.arbitration.status = decision.decision
  submission.arbitration.decisions.push(decision)
  appendWorkspaceAudit(submission, "arbitration.decided", decision.arbitratorId, {
    decision: decision.decision,
  })
  appendTimeline(state, "arbitration.decided", decision.arbitratorId, {
    challengeId: challenge.id,
    submissionId: submission.id,
    decision: decision.decision,
  })
  return decision
}

function releaseMilestonePayout(state, input) {
  const challenge = requireChallenge(state, input.challengeId)
  const submission = requireSubmission(state, input.submissionId)
  if (submission.arbitration.status !== "approved") {
    throw new Error("Payout requires approved arbitration")
  }
  const milestone = Object.values(state.milestones).find(
    (candidate) => candidate.challengeId === challenge.id && candidate.phase === input.phase,
  )
  if (!milestone) {
    throw new Error(`Unknown milestone phase: ${input.phase}`)
  }
  const schedule = challenge.payoutSchedule.find((entry) => entry.phase === input.phase)
  if (!schedule) {
    throw new Error(`No payout schedule for phase: ${input.phase}`)
  }
  const payout = {
    id: `payout-${state.counters.payouts++}`,
    challengeId: challenge.id,
    submissionId: submission.id,
    teamId: submission.teamId,
    phase: input.phase,
    amountCents: schedule.amountCents,
    status: PAYOUT_STATUS.ready,
    routes: [],
    createdAt: timestamp(),
  }
  state.payouts[payout.id] = payout
  milestone.status = MILESTONE_STATUS.paid
  submission.ipTransfer.status = ipStatusAfterPayout(challenge.ipPolicy)
  appendTimeline(state, "payout.ready", challenge.sponsorId, {
    payoutId: payout.id,
    amountCents: payout.amountCents,
  })
  return payout
}

function routePayouts(state, payoutId) {
  const payout = requirePayout(state, payoutId)
  const team = requireTeam(state, payout.teamId)
  payout.routes = team.members.map((member) => ({
    userId: member.userId,
    payoutAccount: member.payoutAccount,
    sharePercent: member.sharePercent,
    amountCents: Math.round((payout.amountCents * member.sharePercent) / 100),
  }))
  payout.status = PAYOUT_STATUS.routed
  payout.routedAt = timestamp()
  appendTimeline(state, "payout.routed", payout.teamId, {
    payoutId: payout.id,
    routes: payout.routes,
  })
  return payout
}

function getChallengeDashboard(state, challengeId) {
  const challenge = requireChallenge(state, challengeId)
  return {
    challenge,
    submissions: challenge.submissions.map((submissionId) => {
      const submission = state.submissions[submissionId]
      return {
        id: submission.id,
        title: submission.title,
        status: submission.status,
        publicTeamId: submission.publicTeamId,
        manifest: generateSubmissionManifest(state, submission.id),
        evaluations: submission.evaluations,
        arbitration: submission.arbitration,
      }
    }),
    milestones: challenge.milestones.map((id) => state.milestones[id]),
    payouts: Object.values(state.payouts).filter((payout) => payout.challengeId === challenge.id),
    timeline: state.timeline.filter((entry) => entry.details.challengeId === challenge.id || entry.action.startsWith("payout.")),
  }
}

function normalizeRubric(criteria) {
  const normalized = requiredArray(criteria, "evaluationCriteria").map((criterion) => ({
    name: requiredString(criterion.name, "criterion.name"),
    weight: requiredNumber(criterion.weight, "criterion.weight"),
  }))
  const totalWeight = round3(normalized.reduce((sum, criterion) => sum + criterion.weight, 0))
  if (totalWeight !== 1) {
    throw new Error("Evaluation criteria weights must total 1")
  }
  return { criteria: normalized, totalWeight }
}

function normalizePayoutSchedule(schedule, prizeAmountCents) {
  const normalized = requiredArray(schedule, "payoutSchedule").map((entry) => ({
    phase: requiredString(entry.phase, "phase"),
    percent: requiredNumber(entry.percent, "percent"),
    amountCents: Math.round((prizeAmountCents * entry.percent) / 100),
  }))
  const totalPercent = normalized.reduce((sum, entry) => sum + entry.percent, 0)
  if (totalPercent !== 100) {
    throw new Error("Payout schedule must total 100 percent")
  }
  return normalized
}

function artifactSatisfiesDeliverable(artifacts, deliverable) {
  const normalized = deliverable.toLowerCase()
  if (normalized.includes("model")) {
    return artifacts.some((artifact) => artifact.kind === "code" || artifact.path.startsWith("code/"))
  }
  if (normalized.includes("dataset")) {
    return artifacts.some((artifact) => artifact.kind === "dataset" || artifact.path.startsWith("data/"))
  }
  if (normalized.includes("whitepaper")) {
    return artifacts.some((artifact) => artifact.kind === "document" || artifact.path.endsWith(".md"))
  }
  return artifacts.some((artifact) => artifact.path.toLowerCase().includes(normalized))
}

function ipStatusAfterPayout(policy) {
  if (policy === IP_POLICIES.sponsoredTransferOnPayout) {
    return "transferred-after-payout"
  }
  if (policy === IP_POLICIES.openSource) {
    return "released-open-source"
  }
  return "licensed-after-payout"
}

function appendWorkspaceAudit(submission, action, actorId, details = {}) {
  const entry = {
    action,
    actorId,
    details,
    createdAt: timestamp(),
  }
  submission.workspace.auditLog.push(entry)
  return entry
}

function appendTimeline(state, action, actorId, details = {}) {
  const entry = {
    id: `timeline-${state.counters.timeline++}`,
    action,
    actorId,
    details,
    createdAt: timestamp(),
  }
  state.timeline.push(entry)
  return entry
}

function requireSponsor(state, sponsorId) {
  const sponsor = state.sponsors[sponsorId]
  if (!sponsor) {
    throw new Error(`Unknown sponsor: ${sponsorId}`)
  }
  return sponsor
}

function requireChallenge(state, challengeId) {
  const challenge = state.challenges[challengeId]
  if (!challenge) {
    throw new Error(`Unknown challenge: ${challengeId}`)
  }
  return challenge
}

function requireTeam(state, teamId) {
  const team = state.teams[teamId]
  if (!team) {
    throw new Error(`Unknown team: ${teamId}`)
  }
  return team
}

function requireSubmission(state, submissionId) {
  const submission = state.submissions[submissionId]
  if (!submission) {
    throw new Error(`Unknown submission: ${submissionId}`)
  }
  return submission
}

function requirePayout(state, payoutId) {
  const payout = state.payouts[payoutId]
  if (!payout) {
    throw new Error(`Unknown payout: ${payoutId}`)
  }
  return payout
}

function requiredEnum(value, allowed, fieldName) {
  const values = Object.values(allowed)
  if (!values.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${values.join(", ")}`)
  }
  return value
}

function requiredArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`)
  }
  return value
}

function requiredString(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

function requiredNumber(value, fieldName) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number`)
  }
  return value
}

function hashContent(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function round3(value) {
  return Math.round(value * 1000) / 1000
}

function floor3(value) {
  return Math.floor(value * 1000) / 1000
}

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
  CHALLENGE_VISIBILITY,
  IP_POLICIES,
  MILESTONE_STATUS,
  PAYOUT_STATUS,
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
}
