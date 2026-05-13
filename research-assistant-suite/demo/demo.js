const {
  ASSISTANT_DOMAINS,
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

const reproducibility = runReproducibilityCheck(state, {
  projectId: project.id,
  sandbox: "node-local-simulated",
  expectedOutputs: ["results/figure-1.png"],
  actualOutputs: ["results/figure-1.png"],
  dependencyLock: { python: "3.12", pandas: "2.2.0" },
  pipelineSteps: ["load data", "run code", "compare outputs"],
})

linkReproducibilityAttempt(state, {
  projectId: project.id,
  status: "failed",
  reason: "Non-deterministic random seed in classifier.",
  confidenceScore: 0.41,
})

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

const researcher = createResearcherProfile(state, {
  id: "researcher-1",
  interests: ["CRISPR", "Alzheimer's", "single-cell RNA-seq"],
  projectHistory: [project.id],
  labCapabilities: ["single-cell RNA-seq", "wet lab validation"],
})

console.log(JSON.stringify({
  review,
  reproducibility,
  gaps,
  opportunityFeed: generateResearchOpportunityFeed(state, {
    researcherId: researcher.id,
    limit: 3,
  }),
}, null, 2))
