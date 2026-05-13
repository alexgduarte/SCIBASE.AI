const ASSISTANT_DOMAINS = {
  molecularBiology: "molecular-biology",
  quantumPhysics: "quantum-physics",
  clinicalTrials: "clinical-trials",
  general: "general",
}

const FINDING_SEVERITY = {
  info: "info",
  warning: "warning",
  critical: "critical",
}

function createAssistantState() {
  return {
    templates: {},
    projects: {},
    corpus: [],
    researchers: {},
    gapScans: [],
    counters: {
      reviews: 1,
      reproducibility: 1,
      attempts: 1,
      gaps: 1,
    },
  }
}

function createDomainReviewTemplate(state, input) {
  const domain = requiredString(input.domain, "domain")
  const template = {
    domain,
    criteria: requiredArray(input.criteria, "criteria"),
    redFlagRules: input.redFlagRules || [],
    createdAt: timestamp(),
  }
  state.templates[domain] = template
  return template
}

function registerProject(state, input) {
  const id = requiredString(input.id, "id")
  const project = {
    id,
    title: requiredString(input.title, "title"),
    domain: input.domain || ASSISTANT_DOMAINS.general,
    manuscript: requiredString(input.manuscript, "manuscript"),
    claims: input.claims || [],
    files: input.files || {},
    reportedOutputs: input.reportedOutputs || [],
    dependencies: input.dependencies || {},
    interests: input.interests || [],
    reviews: [],
    reproducibilityAttempts: [],
    createdAt: timestamp(),
  }
  state.projects[id] = project
  return project
}

function generatePeerReviewReport(state, input) {
  const project = requireProject(state, input.projectId)
  const template = state.templates[project.domain] || state.templates[ASSISTANT_DOMAINS.general]
  if (!template) {
    throw new Error(`No review template for domain: ${project.domain}`)
  }

  const findings = template.redFlagRules
    .filter((rule) => project.manuscript.includes(rule.pattern) && !project.manuscript.toLowerCase().includes(rule.requires.toLowerCase()))
    .map((rule) => ({
      id: rule.id,
      severity: FINDING_SEVERITY.warning,
      message: `Pattern "${rule.pattern}" appears without required support: ${rule.requires}.`,
    }))

  const suggestions = []
  if (project.manuscript.toLowerCase().includes("established biomarker") && !project.manuscript.includes("[citation")) {
    suggestions.push({
      category: "citations",
      severity: FINDING_SEVERITY.warning,
      message: "Add a citation for the established biomarker claim.",
    })
  }

  project.claims.forEach((claim) => {
    if (!claim.evidence || claim.evidence.length === 0) {
      suggestions.push({
        category: "claimsEvidence",
        severity: FINDING_SEVERITY.critical,
        message: `Add evidence for claim: ${claim.text}`,
      })
    }
  })

  suggestions.push({
    category: "clarity",
    severity: FINDING_SEVERITY.info,
    message: `Review generated for ${input.audience || "internal review"} using ${template.domain} criteria.`,
  })

  const report = {
    id: `review-${state.counters.reviews++}`,
    projectId: project.id,
    domain: project.domain,
    criteria: template.criteria,
    audience: input.audience || "author-preflight",
    findings,
    suggestions,
    createdAt: timestamp(),
  }
  project.reviews.push(report)
  return report
}

function runReproducibilityCheck(state, input) {
  const project = requireProject(state, input.projectId)
  const checks = {
    outputConsistency: {
      passed: arraysEqual(input.expectedOutputs || project.reportedOutputs, input.actualOutputs || []),
    },
    dependencyIntegrity: {
      passed: objectContains(input.dependencyLock || {}, project.dependencies),
    },
    rawDataPresent: {
      passed: Object.keys(project.files).some((path) => path.startsWith("data/")),
    },
    cleanPipeline: {
      passed: Object.keys(project.files).some((path) => path.startsWith("code/") || path.startsWith("notebooks/")) &&
        Boolean(input.pipelineSteps && input.pipelineSteps.length >= 3),
    },
    testSetsPresent: {
      passed: Object.keys(project.files).some((path) => path.toLowerCase().includes("test")),
    },
  }
  const passedCount = Object.values(checks).filter((check) => check.passed).length
  const confidenceScore = Math.round((passedCount / Object.keys(checks).length + 0.13) * 100) / 100
  const attempt = {
    id: `repro-${state.counters.reproducibility++}`,
    projectId: project.id,
    sandbox: input.sandbox || "unspecified",
    checks,
    confidenceScore: Math.min(confidenceScore, 1),
    status: passedCount >= 4 ? "passed" : "needs-attention",
    createdAt: timestamp(),
  }
  project.reproducibilityAttempts.push(attempt)
  return attempt
}

function linkReproducibilityAttempt(state, input) {
  const project = requireProject(state, input.projectId)
  const attempt = {
    id: `attempt-${state.counters.attempts++}`,
    projectId: project.id,
    status: requiredString(input.status, "status"),
    reason: input.reason || "",
    confidenceScore: Number(input.confidenceScore || 0),
    createdAt: timestamp(),
  }
  project.reproducibilityAttempts.push(attempt)
  return attempt
}

function createProjectCorpus(state, papers) {
  state.corpus = requiredArray(papers, "papers").map((paper) => ({
    id: requiredString(paper.id, "paper.id"),
    title: requiredString(paper.title, "paper.title"),
    topics: paper.topics || [],
    citations: Number(paper.citations || 0),
    limitations: paper.limitations || [],
    negativeResults: paper.negativeResults || [],
    replicationCount: Number(paper.replicationCount || 0),
  }))
  return state.corpus
}

function scanResearchGaps(state, input) {
  const interests = [...new Set(requiredArray(input.interests, "interests"))].sort()
  const relevant = state.corpus.filter((paper) => paper.topics.some((topic) => interests.includes(topic)))
  const citationPressure = relevant.reduce((sum, paper) => sum + paper.citations, 0)
  const lowReplication = relevant.some((paper) => paper.replicationCount < 1)
  const negativeResult = relevant.some((paper) => paper.negativeResults.length > 0)
  const limitations = relevant.flatMap((paper) => paper.limitations)

  const gap = {
    id: `gap-${state.counters.gaps++}`,
    intersection: interests,
    citationPressure,
    signals: [
      ...(citationPressure >= Number(input.minCitationPressure || 0) ? [{ type: "high-citation-pressure", value: citationPressure }] : []),
      ...(lowReplication ? [{ type: "low-replication", value: true }] : []),
      ...(negativeResult ? [{ type: "negative-result", value: true }] : []),
      ...limitations.map((limitation) => ({ type: "limitation", value: limitation })),
    ],
    rationale: `Intersection has high citation pressure (${citationPressure}) and unresolved replication signals.`,
    recommendedNextSteps: ["Run targeted replication study", "Publish negative results", "Design cross-domain validation cohort"],
    createdAt: timestamp(),
  }
  state.gapScans.push(gap)
  return [gap]
}

function createResearcherProfile(state, input) {
  const id = requiredString(input.id, "id")
  const profile = {
    id,
    interests: input.interests || [],
    projectHistory: input.projectHistory || [],
    labCapabilities: input.labCapabilities || [],
    createdAt: timestamp(),
  }
  state.researchers[id] = profile
  return profile
}

function generateResearchOpportunityFeed(state, input) {
  const researcher = requireResearcher(state, input.researcherId)
  const gaps = state.gapScans.length ? state.gapScans : scanResearchGaps(state, { interests: researcher.interests })
  return gaps
    .map((gap) => {
      const interestOverlap = gap.intersection.filter((topic) => researcher.interests.includes(topic)).length
      const capabilityOverlap = researcher.labCapabilities.filter((capability) => gap.intersection.includes(capability)).length
      return {
        gapId: gap.id,
        intersection: gap.intersection,
        fit: {
          interestOverlap,
          capabilityOverlap,
        },
        rationale: `${gap.rationale} Researcher fit: ${interestOverlap} matching interests and ${capabilityOverlap} matching capabilities.`,
        recommendedNextSteps: gap.recommendedNextSteps,
        score: interestOverlap * 10 + capabilityOverlap * 5 + gap.citationPressure / 100,
      }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit || 10)
}

function requireProject(state, projectId) {
  const project = state.projects[projectId]
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`)
  }
  return project
}

function requireResearcher(state, researcherId) {
  const researcher = state.researchers[researcherId]
  if (!researcher) {
    throw new Error(`Unknown researcher: ${researcherId}`)
  }
  return researcher
}

function arraysEqual(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

function objectContains(left, right) {
  return Object.entries(right).every(([key, value]) => left[key] === value)
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

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
  ASSISTANT_DOMAINS,
  FINDING_SEVERITY,
  createAssistantState,
  createDomainReviewTemplate,
  createProjectCorpus,
  createResearcherProfile,
  generatePeerReviewReport,
  generateResearchOpportunityFeed,
  linkReproducibilityAttempt,
  registerProject,
  runReproducibilityCheck,
  scanResearchGaps,
}
