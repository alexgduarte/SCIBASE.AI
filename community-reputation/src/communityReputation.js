const REVIEW_MODES = {
  public: "public",
  semiPrivate: "semi-private",
  anonymous: "anonymous",
}

const TARGET_TYPES = {
  document: "document",
  dataset: "dataset",
  code: "code",
  notebook: "notebook",
}

const CREDIT_ROLES = {
  conceptualization: "Conceptualization",
  dataCuration: "Data curation",
  software: "Software",
  validation: "Validation",
  writing: "Writing",
  peerReview: "Peer review",
}

const BADGE_IDS = {
  trustedReviewer: "trusted-reviewer",
  openScienceChampion: "open-science-champion",
  reproducibilityVerifier: "reproducibility-verifier",
  bountySolver: "bounty-solver",
}

function createCommunityState() {
  return {
    users: {},
    projects: {},
    templates: {},
    reviews: {},
    comments: {},
    contributions: {},
    endorsements: {},
    badges: {},
    timeline: [],
    counters: {
      reviews: 1,
      comments: 1,
      contributions: 1,
      endorsements: 1,
      timeline: 1,
    },
  }
}

function createBadgeCatalog(state) {
  state.badges = {
    [BADGE_IDS.trustedReviewer]: {
      id: BADGE_IDS.trustedReviewer,
      name: "Trusted Reviewer",
      criteria: "Complete at least two high-quality peer reviews.",
    },
    [BADGE_IDS.openScienceChampion]: {
      id: BADGE_IDS.openScienceChampion,
      name: "Open Science Champion",
      criteria: "Earn endorsements, verify reproducibility, and complete a scientific bounty.",
    },
    [BADGE_IDS.reproducibilityVerifier]: {
      id: BADGE_IDS.reproducibilityVerifier,
      name: "Reproducibility Verifier",
      criteria: "Complete an independent reproducibility verification.",
    },
    [BADGE_IDS.bountySolver]: {
      id: BADGE_IDS.bountySolver,
      name: "Bounty Solver",
      criteria: "Complete a scientific bounty or challenge.",
    },
  }
  return state.badges
}

function createUser(state, input) {
  const id = requiredString(input.id, "id")
  const user = {
    id,
    name: requiredString(input.name, "name"),
    institution: input.institution || null,
    domain: input.domain || "general",
    region: input.region || "global",
    reviewHistory: [],
    visibleCredits: [],
    citationPages: [],
    metrics: {
      citations: 0,
      forks: 0,
      endorsements: 0,
      peerReviewsCompleted: 0,
      peerReviewQuality: 0,
      comments: 0,
      contributions: 0,
      reproducibilityVerifications: 0,
      bountyCompletions: 0,
      challengePerformanceUsd: 0,
    },
    reputationScore: 0,
    badges: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.users[id] = user
  appendTimeline(state, "user.created", id, { userId: id })
  return user
}

function createProject(state, input) {
  const owner = requireUser(state, input.ownerId)
  const id = requiredString(input.id, "id")
  const project = {
    id,
    title: requiredString(input.title, "title"),
    domain: input.domain || owner.domain,
    ownerId: owner.id,
    visibility: input.visibility || "public",
    timeline: [],
    reviews: [],
    comments: [],
    contributions: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.projects[id] = project
  appendProjectTimeline(state, project, "project.created", owner.id, { title: project.title })
  return project
}

function createReviewTemplate(state, input) {
  const id = requiredString(input.id, "id")
  const template = {
    id,
    discipline: requiredString(input.discipline, "discipline"),
    criteria: requiredArray(input.criteria, "criteria"),
    createdAt: timestamp(),
  }
  state.templates[id] = template
  return template
}

function submitPeerReview(state, input) {
  const project = requireProject(state, input.projectId)
  const reviewer = requireUser(state, input.reviewerId)
  const template = requireTemplate(state, input.templateId)
  const mode = requiredReviewMode(input.mode)
  const scores = normalizeScores(input.scores || {}, template.criteria)
  const averageScore = average(Object.values(scores))
  const review = {
    id: `review-${state.counters.reviews++}`,
    projectId: project.id,
    reviewerId: reviewer.id,
    publicReviewerId: mode === REVIEW_MODES.anonymous ? "anonymous" : reviewer.id,
    templateId: template.id,
    discipline: template.discipline,
    mode,
    scores,
    averageScore,
    summary: requiredString(input.summary, "summary"),
    visibleTo: visibilityForMode(mode),
    createdAt: timestamp(),
  }

  state.reviews[review.id] = review
  project.reviews.push(review.id)
  reviewer.reviewHistory.push({
    reviewId: review.id,
    projectId: project.id,
    averageScore,
    mode,
    createdAt: review.createdAt,
  })
  reviewer.metrics.peerReviewsCompleted += 1
  reviewer.metrics.peerReviewQuality += averageScore
  updateUserRecognition(state, reviewer)
  appendProjectTimeline(state, project, "peer_review.submitted", reviewer.id, {
    reviewId: review.id,
    publicReviewerId: review.publicReviewerId,
    averageScore,
  })
  return review
}

function recordInlineComment(state, input) {
  const project = requireProject(state, input.projectId)
  const user = requireUser(state, input.userId)
  const mode = requiredReviewMode(input.mode)
  const comment = {
    id: `comment-${state.counters.comments++}`,
    projectId: project.id,
    userId: user.id,
    targetType: requiredEnum(input.targetType, TARGET_TYPES, "targetType"),
    targetPath: requiredString(input.targetPath, "targetPath"),
    anchor: input.anchor || null,
    body: requiredString(input.body, "body"),
    mode,
    visibleTo: visibilityForMode(mode),
    createdAt: timestamp(),
  }

  state.comments[comment.id] = comment
  project.comments.push(comment.id)
  user.metrics.comments += 1
  updateUserRecognition(state, user)
  appendProjectTimeline(state, project, "inline_comment.created", user.id, {
    commentId: comment.id,
    targetType: comment.targetType,
    targetPath: comment.targetPath,
  })
  return comment
}

function recordContribution(state, input) {
  const project = requireProject(state, input.projectId)
  const user = requireUser(state, input.userId)
  const contribution = {
    id: `contribution-${state.counters.contributions++}`,
    projectId: project.id,
    userId: user.id,
    role: requiredEnum(input.role, CREDIT_ROLES, "role"),
    target: requiredString(input.target, "target"),
    createdAt: timestamp(),
  }

  state.contributions[contribution.id] = contribution
  project.contributions.push(contribution.id)
  user.visibleCredits.push(contribution)
  user.citationPages.push({
    projectId: project.id,
    role: contribution.role,
    target: contribution.target,
  })
  user.metrics.contributions += 1
  updateUserRecognition(state, user)
  appendProjectTimeline(state, project, "contribution.recorded", user.id, {
    contributionId: contribution.id,
    role: contribution.role,
    target: contribution.target,
  })
  return contribution
}

function summarizeContributorGraph(state, projectId) {
  const project = requireProject(state, projectId)
  const contributions = project.contributions.map((id) => state.contributions[id])
  const nodes = [...new Set(contributions.map((contribution) => contribution.userId))].map((userId) => {
    const user = requireUser(state, userId)
    return {
      userId,
      name: user.name,
      contributionCount: contributions.filter((contribution) => contribution.userId === userId).length,
    }
  })
  const edges = contributions.map((contribution) => ({
    from: contribution.userId,
    to: project.id,
    role: contribution.role,
    target: contribution.target,
    createdAt: contribution.createdAt,
  }))
  return { projectId, nodes, edges }
}

function recordCitation(state, input) {
  const user = requireUser(state, input.userId)
  requireProject(state, input.projectId)
  user.metrics.citations += requiredNumber(input.count, "count")
  updateUserRecognition(state, user)
  return user.metrics.citations
}

function recordFork(state, input) {
  const user = requireUser(state, input.userId)
  requireProject(state, input.projectId)
  user.metrics.forks += requiredNumber(input.count, "count")
  updateUserRecognition(state, user)
  return user.metrics.forks
}

function grantEndorsement(state, input) {
  requireUser(state, input.fromUserId)
  const toUser = requireUser(state, input.toUserId)
  const endorsement = {
    id: `endorsement-${state.counters.endorsements++}`,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    reason: requiredString(input.reason, "reason"),
    createdAt: timestamp(),
  }
  state.endorsements[endorsement.id] = endorsement
  toUser.metrics.endorsements += 1
  updateUserRecognition(state, toUser)
  appendTimeline(state, "endorsement.granted", input.fromUserId, endorsement)
  return endorsement
}

function recordReproducibilityVerification(state, input) {
  const project = requireProject(state, input.projectId)
  const user = requireUser(state, input.userId)
  if (input.verified) {
    user.metrics.reproducibilityVerifications += 1
  }
  updateUserRecognition(state, user)
  appendProjectTimeline(state, project, "reproducibility.verified", user.id, {
    verified: Boolean(input.verified),
    confidence: Number(input.confidence || 0),
  })
  return user.metrics.reproducibilityVerifications
}

function recordBountyCompletion(state, input) {
  const user = requireUser(state, input.userId)
  user.metrics.bountyCompletions += 1
  user.metrics.challengePerformanceUsd += requiredNumber(input.amountUsd, "amountUsd")
  updateUserRecognition(state, user)
  appendTimeline(state, "bounty.completed", user.id, {
    bountyId: requiredString(input.bountyId, "bountyId"),
    amountUsd: input.amountUsd,
  })
  return user.metrics.bountyCompletions
}

function getUserProfile(state, userId) {
  const user = requireUser(state, userId)
  return {
    id: user.id,
    name: user.name,
    institution: user.institution,
    domain: user.domain,
    region: user.region,
    reviewHistory: user.reviewHistory,
    visibleCredits: user.visibleCredits,
    citationPages: user.citationPages,
    metrics: user.metrics,
    reputationScore: user.reputationScore,
    badges: user.badges,
  }
}

function getProjectTimeline(state, projectId) {
  return requireProject(state, projectId).timeline
}

function listLeaderboard(state, filters = {}) {
  return Object.values(state.users)
    .filter((user) => !filters.domain || user.domain === filters.domain)
    .filter((user) => !filters.region || user.region === filters.region)
    .filter((user) => !filters.institution || user.institution === filters.institution)
    .sort((left, right) => right.reputationScore - left.reputationScore || left.name.localeCompare(right.name))
    .map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      name: user.name,
      reputationScore: user.reputationScore,
      badges: user.badges.map((badge) => badge.id),
    }))
}

function updateUserRecognition(state, user) {
  const peerReviewAverage = user.metrics.peerReviewsCompleted
    ? user.metrics.peerReviewQuality / user.metrics.peerReviewsCompleted
    : 0
  user.reputationScore = Math.round(
    user.metrics.citations * 2 +
      user.metrics.forks * 5 +
      user.metrics.endorsements * 12 +
      user.metrics.peerReviewsCompleted * 15 +
      peerReviewAverage * 10 +
      user.metrics.comments * 2 +
      user.metrics.contributions * 4 +
      user.metrics.reproducibilityVerifications * 20 +
      user.metrics.bountyCompletions * 25 +
      user.metrics.challengePerformanceUsd / 25,
  )

  const badges = []
  if (user.metrics.peerReviewsCompleted >= 2 && peerReviewAverage >= 4) {
    badges.push(state.badges[BADGE_IDS.trustedReviewer])
  }
  if (user.metrics.reproducibilityVerifications > 0) {
    badges.push(state.badges[BADGE_IDS.reproducibilityVerifier])
  }
  if (user.metrics.bountyCompletions > 0) {
    badges.push(state.badges[BADGE_IDS.bountySolver])
  }
  if (user.metrics.endorsements > 0 && user.metrics.reproducibilityVerifications > 0 && user.metrics.bountyCompletions > 0) {
    badges.push(state.badges[BADGE_IDS.openScienceChampion])
  }
  user.badges = badges.filter(Boolean)
  user.updatedAt = timestamp()
}

function visibilityForMode(mode) {
  if (mode === REVIEW_MODES.public) {
    return { public: true, authors: true, reviewers: true }
  }
  if (mode === REVIEW_MODES.semiPrivate) {
    return { public: false, authors: true, reviewers: true }
  }
  return { public: true, authors: true, reviewers: false, anonymous: true }
}

function normalizeScores(scores, criteria) {
  return Object.keys(scores).reduce((result, key) => {
    if (!criteria.includes(key)) {
      throw new Error(`Score is not part of the selected template: ${key}`)
    }
    const score = requiredNumber(scores[key], key)
    if (score < 1 || score > 5) {
      throw new Error(`Score must be between 1 and 5: ${key}`)
    }
    result[key] = score
    return result
  }, {})
}

function average(values) {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function appendProjectTimeline(state, project, action, actorId, details = {}) {
  const entry = appendTimeline(state, action, actorId, {
    projectId: project.id,
    ...details,
  })
  project.timeline.push(entry)
  project.updatedAt = timestamp()
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

function requireUser(state, userId) {
  const user = state.users[userId]
  if (!user) {
    throw new Error(`Unknown user: ${userId}`)
  }
  return user
}

function requireProject(state, projectId) {
  const project = state.projects[projectId]
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`)
  }
  return project
}

function requireTemplate(state, templateId) {
  const template = state.templates[templateId]
  if (!template) {
    throw new Error(`Unknown review template: ${templateId}`)
  }
  return template
}

function requiredReviewMode(mode) {
  return requiredEnum(mode, REVIEW_MODES, "mode")
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

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
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
}
