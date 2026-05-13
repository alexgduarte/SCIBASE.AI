const assert = require("assert")

const {
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
} = require("../src/researchAssistantSuite")

const state = createAssistantState()

createDomainReviewTemplate(state, {
  domain: ASSISTANT_DOMAINS.molecularBiology,
  criteria: ["clarity", "methodology", "citations", "claimsEvidence", "reproducibility"],
  redFlagRules: [
    { id: "missing-statistics", pattern: "p < 0.05", requires: "statistical test" },
    { id: "missing-citation", pattern: "established biomarker", requires: "citation" },
  ],
})

const project = registerProject(state, {
  id: "project-1",
  title: "Single-cell Alzheimer's Biomarker Study",
  domain: ASSISTANT_DOMAINS.molecularBiology,
  manuscript: [
    "We identify an established biomarker in single-cell RNA-seq cohorts.",
    "The treatment effect is significant at p < 0.05.",
    "All claims are supported by cohort.csv and figure-1.png.",
  ].join("\n"),
  claims: [
    { text: "Biomarker signal is reproducible.", evidence: ["results/figure-1.png"] },
    { text: "Treatment effect is statistically significant.", evidence: [] },
  ],
  files: {
    "data/cohort.csv": "sample,marker\nA,0.42",
    "code/run_analysis.py": "print('figure-1.png')",
    "notebooks/analysis.ipynb": "{}",
    "results/figure-1.png": "binary-placeholder",
    "requirements.txt": "pandas==2.2.0",
  },
  reportedOutputs: ["results/figure-1.png"],
  dependencies: { python: "3.12", pandas: "2.2.0" },
  interests: ["CRISPR", "Alzheimer's", "single-cell RNA-seq"],
})

const review = generatePeerReviewReport(state, {
  projectId: project.id,
  audience: "author-preflight",
})

assert.strictEqual(review.domain, ASSISTANT_DOMAINS.molecularBiology)
assert.ok(review.suggestions.some((item) => item.category === "citations"))
assert.ok(review.suggestions.some((item) => item.category === "claimsEvidence"))
assert.ok(review.findings.some((finding) => finding.id === "missing-statistics"))
assert.ok(review.findings.some((finding) => finding.severity === FINDING_SEVERITY.warning))

const reproducibility = runReproducibilityCheck(state, {
  projectId: project.id,
  sandbox: "node-local-simulated",
  expectedOutputs: ["results/figure-1.png"],
  actualOutputs: ["results/figure-1.png"],
  dependencyLock: { python: "3.12", pandas: "2.2.0" },
  pipelineSteps: ["load data", "run code", "compare outputs"],
})

assert.strictEqual(reproducibility.confidenceScore, 0.93)
assert.strictEqual(reproducibility.checks.outputConsistency.passed, true)
assert.strictEqual(reproducibility.checks.dependencyIntegrity.passed, true)
assert.strictEqual(reproducibility.checks.rawDataPresent.passed, true)
assert.strictEqual(reproducibility.checks.cleanPipeline.passed, true)

const failedAttempt = linkReproducibilityAttempt(state, {
  projectId: project.id,
  status: "failed",
  reason: "Non-deterministic random seed in classifier.",
  confidenceScore: 0.41,
})

assert.strictEqual(failedAttempt.status, "failed")
assert.strictEqual(state.projects[project.id].reproducibilityAttempts.length, 2)

createProjectCorpus(state, [
  {
    id: "paper-1",
    title: "CRISPR screens in Alzheimer's models",
    topics: ["CRISPR", "Alzheimer's"],
    citations: 120,
    limitations: ["Few single-cell replication studies"],
    negativeResults: [],
    replicationCount: 1,
  },
  {
    id: "paper-2",
    title: "Single-cell RNA-seq atlas of neurodegeneration",
    topics: ["single-cell RNA-seq", "Alzheimer's"],
    citations: 95,
    limitations: ["No perturbation experiments"],
    negativeResults: ["CRISPR perturbation did not replicate bulk signal"],
    replicationCount: 0,
  },
  {
    id: "paper-3",
    title: "CRISPR perturbation in immune cells",
    topics: ["CRISPR", "single-cell RNA-seq"],
    citations: 80,
    limitations: ["Not tested in Alzheimer's cohorts"],
    negativeResults: [],
    replicationCount: 0,
  },
])

const gaps = scanResearchGaps(state, {
  interests: ["CRISPR", "Alzheimer's", "single-cell RNA-seq"],
  minCitationPressure: 50,
})

assert.strictEqual(gaps[0].intersection.join(" + "), "Alzheimer's + CRISPR + single-cell RNA-seq")
assert.ok(gaps[0].signals.some((signal) => signal.type === "low-replication"))
assert.ok(gaps[0].signals.some((signal) => signal.type === "negative-result"))

const researcher = createResearcherProfile(state, {
  id: "researcher-1",
  interests: ["CRISPR", "Alzheimer's", "single-cell RNA-seq"],
  projectHistory: [project.id],
  labCapabilities: ["single-cell RNA-seq", "wet lab validation"],
})

const feed = generateResearchOpportunityFeed(state, {
  researcherId: researcher.id,
  limit: 3,
})

assert.strictEqual(feed[0].fit.interestOverlap, 3)
assert.ok(feed[0].recommendedNextSteps.includes("Run targeted replication study"))
assert.ok(feed[0].rationale.includes("high citation pressure"))

console.log("research assistant suite tests passed")
