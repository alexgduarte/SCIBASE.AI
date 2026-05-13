const assert = require("assert")

const {
  BADGE_IDS,
  CREDIT_ROLES,
  REVIEW_MODES,
  TARGET_TYPES,
  createBadgeCatalog,
  createCommunityState,
  createProject,
  createReviewTemplate,
  createUser,
  getProjectTimeline,
  getUserProfile,
  grantEndorsement,
  listLeaderboard,
  recordBountyCompletion,
  recordCitation,
  recordContribution,
  recordFork,
  recordInlineComment,
  recordReproducibilityVerification,
  submitPeerReview,
  summarizeContributorGraph,
} = require("../src/communityReputation")

const state = createCommunityState()
createBadgeCatalog(state)

const reviewer = createUser(state, {
  id: "reviewer-1",
  name: "Dr. Reviewer",
  institution: "Open Science Lab",
  domain: "biology",
  region: "Europe",
})

const author = createUser(state, {
  id: "author-1",
  name: "Dr. Author",
  institution: "SCIBASE Lab",
  domain: "biology",
  region: "Europe",
})

const project = createProject(state, {
  id: "project-1",
  title: "Alzheimer's Biomarker Study",
  domain: "biology",
  ownerId: author.id,
  visibility: "public",
})

const template = createReviewTemplate(state, {
  id: "biology-peer-review",
  discipline: "biology",
  criteria: ["clarity", "rigor", "novelty", "reproducibility"],
})

const review = submitPeerReview(state, {
  projectId: project.id,
  reviewerId: reviewer.id,
  templateId: template.id,
  mode: REVIEW_MODES.public,
  scores: {
    clarity: 4,
    rigor: 5,
    novelty: 3,
    reproducibility: 5,
  },
  summary: "Clear, rigorous, and reproducible.",
})

assert.strictEqual(review.averageScore, 4.25)
assert.strictEqual(review.visibleTo.public, true)
assert.ok(getUserProfile(state, reviewer.id).reviewHistory.some((entry) => entry.reviewId === review.id))
assert.ok(getProjectTimeline(state, project.id).some((entry) => entry.action === "peer_review.submitted"))

const blindedReview = submitPeerReview(state, {
  projectId: project.id,
  reviewerId: reviewer.id,
  templateId: template.id,
  mode: REVIEW_MODES.anonymous,
  scores: {
    clarity: 5,
    rigor: 5,
  },
  summary: "Strong anonymous replication review.",
})

assert.strictEqual(blindedReview.visibleTo.public, true)
assert.strictEqual(blindedReview.publicReviewerId, "anonymous")

const comment = recordInlineComment(state, {
  projectId: project.id,
  userId: reviewer.id,
  targetType: TARGET_TYPES.notebook,
  targetPath: "notebooks/analysis.ipynb",
  anchor: "cell:4",
  body: "Please report random seeds for this model run.",
  mode: REVIEW_MODES.semiPrivate,
})

assert.strictEqual(comment.targetType, TARGET_TYPES.notebook)
assert.strictEqual(comment.visibleTo.authors, true)
assert.strictEqual(comment.visibleTo.reviewers, true)
assert.strictEqual(comment.visibleTo.public, false)

recordContribution(state, {
  projectId: project.id,
  userId: author.id,
  role: CREDIT_ROLES.conceptualization,
  target: "manuscript/preprint.md",
})

recordContribution(state, {
  projectId: project.id,
  userId: reviewer.id,
  role: CREDIT_ROLES.validation,
  target: "notebooks/analysis.ipynb",
})

recordContribution(state, {
  projectId: project.id,
  userId: reviewer.id,
  role: CREDIT_ROLES.software,
  target: "code/reproduce.py",
})

const graph = summarizeContributorGraph(state, project.id)
assert.strictEqual(graph.nodes.length, 2)
assert.ok(graph.edges.some((edge) => edge.role === CREDIT_ROLES.validation))

recordCitation(state, { projectId: project.id, userId: author.id, count: 12 })
recordFork(state, { projectId: project.id, userId: author.id, count: 3 })
grantEndorsement(state, {
  fromUserId: author.id,
  toUserId: reviewer.id,
  reason: "Excellent reproducibility review",
})
recordReproducibilityVerification(state, {
  projectId: project.id,
  userId: reviewer.id,
  verified: true,
  confidence: 0.94,
})
recordBountyCompletion(state, {
  userId: reviewer.id,
  bountyId: "challenge-42",
  amountUsd: 525,
})

const reviewerProfile = getUserProfile(state, reviewer.id)
assert.strictEqual(reviewerProfile.metrics.peerReviewsCompleted, 2)
assert.strictEqual(reviewerProfile.metrics.endorsements, 1)
assert.strictEqual(reviewerProfile.metrics.reproducibilityVerifications, 1)
assert.strictEqual(reviewerProfile.metrics.bountyCompletions, 1)
assert.ok(reviewerProfile.reputationScore > getUserProfile(state, author.id).reputationScore)
assert.ok(reviewerProfile.badges.some((badge) => badge.id === BADGE_IDS.trustedReviewer))
assert.ok(reviewerProfile.badges.some((badge) => badge.id === BADGE_IDS.openScienceChampion))

const leaderboard = listLeaderboard(state, { domain: "biology", region: "Europe", institution: "Open Science Lab" })
assert.strictEqual(leaderboard[0].userId, reviewer.id)
assert.strictEqual(leaderboard[0].rank, 1)

console.log("community reputation tests passed")
