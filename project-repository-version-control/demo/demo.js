const {
  checkReproducibility,
  createBranch,
  createCommit,
  createExportManifest,
  createMergeRequest,
  createRepository,
  forkRepository,
  generateCitation,
  mergeRequest,
  tagVersion,
} = require("../src/repositoryVersionControl")

const repository = createRepository({
  id: "alzheimers-biomarker-study",
  title: "Alzheimer's Biomarker Study",
  authors: [{ name: "A. Researcher", orcid: "0000-0001-2345-6789" }],
  affiliations: ["SCIBASE Lab"],
  funding: ["Grant-123"],
  tags: ["biomarkers", "reproducibility"],
})

const firstCommit = createCommit(repository, {
  author: "A. Researcher",
  message: "Add reproducible project skeleton",
  changes: [
    { path: "manuscript/preprint.md", content: "# Alzheimer's Biomarker Study" },
    { path: "data/cohort.csv", content: "participant,marker\np1,0.42" },
    { path: "code/run_analysis.py", content: "print('analysis complete')" },
    { path: "notebooks/run_analysis.ipynb", content: "{}" },
    { path: "results/figure-1.png", content: "binary-placeholder" },
    { path: "protocols/lab-procedure.md", content: "# Protocol" },
    { path: "requirements.txt", content: "pandas==2.2.0" },
  ],
})

createBranch(repository, "hypothesis-inflammatory-markers", firstCommit.id)

createCommit(repository, {
  branch: "hypothesis-inflammatory-markers",
  author: "B. Reviewer",
  message: "Add inflammatory marker sensitivity analysis",
  changes: [{ path: "code/inflammatory_sensitivity.py", content: "print('sensitivity')" }],
})

const merge = createMergeRequest(repository, {
  sourceBranch: "hypothesis-inflammatory-markers",
  targetBranch: "main",
  title: "Add inflammatory marker sensitivity analysis",
  author: "B. Reviewer",
  reviewers: ["A. Researcher"],
})

mergeRequest(repository, merge.id, "A. Researcher")

tagVersion(repository, {
  name: "preprint-v1.0",
  commitId: repository.branches.main.head,
  doi: "10.5555/scibase.alzheimers-biomarker-study.v1",
})

forkRepository(repository, {
  forkId: "alzheimers-biomarker-study-independent-replication",
  owner: "Replication Lab",
  reason: "Independent cohort replication",
})

console.log(JSON.stringify({
  repositoryId: repository.id,
  head: repository.branches.main.head,
  reproducibility: checkReproducibility(repository),
  citation: generateCitation(repository, "preprint-v1.0"),
  exportManifest: createExportManifest(repository),
}, null, 2))
