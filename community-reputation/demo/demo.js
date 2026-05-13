const {
  CREDIT_ROLES,
  REVIEW_MODES,
  TARGET_TYPES,
  createBadgeCatalog,
  createCommunityState,
  createProject,
  createReviewTemplate,
  createUser,
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

submitPeerReview(state, {
  projectId: project.id,
  reviewerId: reviewer.id,
  templateId: template.id,
  mode: REVIEW_MODES.public,
  scores: { clarity: 4, rigor: 5, novelty: 3, reproducibility: 5 },
  summary: "Clear, rigorous, and reproducible.",
})

submitPeerReview(state, {
  projectId: project.id,
  reviewerId: reviewer.id,
  templateId: template.id,
  mode: REVIEW_MODES.anonymous,
  scores: { clarity: 5, rigor: 5 },
  summary: "Strong anonymous replication review.",
})

recordInlineComment(state, {
  projectId: project.id,
  userId: reviewer.id,
  targetType: TARGET_TYPES.notebook,
  targetPath: "notebooks/analysis.ipynb",
  anchor: "cell:4",
  body: "Please report random seeds for this model run.",
  mode: REVIEW_MODES.semiPrivate,
})

recordContribution(state, {
  projectId: project.id,
  userId: reviewer.id,
  role: CREDIT_ROLES.validation,
  target: "notebooks/analysis.ipynb",
})

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

console.log(JSON.stringify({
  reviewerProfile: getUserProfile(state, reviewer.id),
  contributorGraph: summarizeContributorGraph(state, project.id),
  leaderboard: listLeaderboard(state, { domain: "biology", region: "Europe" }),
}, null, 2))
