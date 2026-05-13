const crypto = require("crypto")

const REQUIRED_COMPONENTS = [
  { path: "manuscript/", kind: "manuscript", description: "Structured paper text in Markdown, LaTeX, or WYSIWYG formats." },
  { path: "data/", kind: "data", description: "Uploaded datasets, structured tables, or linked APIs." },
  { path: "code/", kind: "code", description: "Analysis scripts, packages, and reusable source code." },
  { path: "notebooks/", kind: "notebook", description: "Jupyter-style interactive documents." },
  { path: "results/", kind: "result", description: "Plots, figures, trained weights, and derived outputs." },
  { path: "protocols/", kind: "protocol", description: "Editable experiment plans and lab procedures." },
  { path: "metadata.json", kind: "metadata", description: "DOI, authors, affiliations, funding, tags, and schema.org markup." },
]

const EDITOR_CAPABILITIES = {
  ".md": ["markdown-editor", "rich-diff"],
  ".markdown": ["markdown-editor", "rich-diff"],
  ".tex": ["latex-editor", "semantic-diff"],
  ".csv": ["table-editor", "cell-diff"],
  ".json": ["json-editor", "structural-diff"],
  ".ipynb": ["notebook-editor", "cell-output-diff"],
  ".py": ["code-editor", "syntax-aware-diff"],
  ".r": ["code-editor", "syntax-aware-diff"],
  ".jl": ["code-editor", "syntax-aware-diff"],
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function hashContent(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex")
}

function createRepository(input) {
  const now = new Date().toISOString()
  const id = requiredString(input.id, "id")
  const title = requiredString(input.title, "title")
  const authors = Array.isArray(input.authors) ? input.authors : []

  return {
    id,
    title,
    structure: REQUIRED_COMPONENTS,
    files: {},
    metadata: {
      doi: input.doi || null,
      authors,
      affiliations: input.affiliations || [],
      funding: input.funding || [],
      tags: input.tags || [],
      schemaOrg: {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: title,
        identifier: input.doi || id,
        author: authors.map((author) => ({ "@type": "Person", name: author.name, identifier: author.orcid })),
      },
    },
    branches: {
      main: { name: "main", head: null },
    },
    commits: [],
    tags: [],
    forks: [],
    mergeRequests: [],
    editorCapabilities: EDITOR_CAPABILITIES,
    api: createApiContract(id),
    cli: createCliContract(id),
    createdAt: now,
    updatedAt: now,
  }
}

function createCommit(repository, input) {
  const branchName = input.branch || "main"
  ensureBranch(repository, branchName)
  const changes = normalizeChanges(input.changes)
  changes.forEach(validateComponentPath)

  const parent = repository.branches[branchName].head
  const snapshot = { ...repository.files }
  changes.forEach((change) => {
    snapshot[change.path] = {
      path: change.path,
      contentHash: hashContent(change.content),
      mediaType: change.mediaType || inferMediaType(change.path),
      editorCapabilities: getEditorCapabilities(change.path),
      updatedBy: input.author,
      updatedAt: new Date().toISOString(),
    }
  })

  const commit = {
    id: `commit-${repository.commits.length + 1}-${hashContent({ parent, changes }).slice(0, 12)}`,
    branch: branchName,
    parent,
    author: requiredString(input.author, "author"),
    message: requiredString(input.message, "message"),
    changes,
    contentHash: hashContent(snapshot),
    createdAt: new Date().toISOString(),
  }

  repository.files = snapshot
  repository.commits.push(commit)
  repository.branches[branchName].head = commit.id
  repository.updatedAt = commit.createdAt
  return commit
}

function createBranch(repository, name, fromCommitId = repository.branches.main.head) {
  if (repository.branches[name]) {
    throw new Error(`Branch already exists: ${name}`)
  }
  assertCommitExists(repository, fromCommitId)
  repository.branches[name] = { name, head: fromCommitId }
  return repository.branches[name]
}

function rollbackBranch(repository, branchName, commitId) {
  ensureBranch(repository, branchName)
  assertCommitExists(repository, commitId)
  repository.branches[branchName].head = commitId
  repository.updatedAt = new Date().toISOString()
  return repository.branches[branchName]
}

function tagVersion(repository, input) {
  assertCommitExists(repository, input.commitId)
  const tag = {
    name: requiredString(input.name, "name"),
    commitId: input.commitId,
    doi: input.doi || repository.metadata.doi,
    semanticVersion: input.semanticVersion || input.name,
    citation: generateCitation(repository, input.name, "apa", input.doi),
    createdAt: new Date().toISOString(),
  }
  repository.tags.push(tag)
  return tag
}

function forkRepository(repository, input) {
  const fork = {
    id: requiredString(input.forkId, "forkId"),
    sourceRepositoryId: repository.id,
    sourceHead: repository.branches.main.head,
    owner: requiredString(input.owner, "owner"),
    reason: input.reason || "downstream derivation",
    attribution: repository.metadata.authors,
    createdAt: new Date().toISOString(),
  }
  repository.forks.push(fork)
  return fork
}

function createMergeRequest(repository, input) {
  ensureBranch(repository, input.sourceBranch)
  ensureBranch(repository, input.targetBranch || "main")
  const mergeRequest = {
    id: `mr-${repository.mergeRequests.length + 1}`,
    title: requiredString(input.title, "title"),
    author: requiredString(input.author, "author"),
    sourceBranch: input.sourceBranch,
    targetBranch: input.targetBranch || "main",
    discussion: input.discussion || [],
    reviewers: input.reviewers || [],
    status: "open",
    provenance: {
      sourceHead: repository.branches[input.sourceBranch].head,
      targetHead: repository.branches[input.targetBranch || "main"].head,
    },
    createdAt: new Date().toISOString(),
  }
  repository.mergeRequests.push(mergeRequest)
  return mergeRequest
}

function mergeRequest(repository, mergeRequestId, reviewer) {
  const mergeRequest = repository.mergeRequests.find((candidate) => candidate.id === mergeRequestId)
  if (!mergeRequest) {
    throw new Error(`Unknown merge request: ${mergeRequestId}`)
  }
  if (mergeRequest.status !== "open") {
    throw new Error(`Merge request is not open: ${mergeRequestId}`)
  }
  const commit = createCommit(repository, {
    branch: mergeRequest.targetBranch,
    author: reviewer,
    message: `Merge ${mergeRequest.sourceBranch} into ${mergeRequest.targetBranch}: ${mergeRequest.title}`,
    changes: [
      {
        path: "metadata.json",
        content: {
          mergedFrom: mergeRequest.sourceBranch,
          reviewedBy: reviewer,
          mergedAt: new Date().toISOString(),
        },
      },
    ],
  })
  mergeRequest.status = "merged"
  mergeRequest.mergedBy = reviewer
  mergeRequest.mergeCommitId = commit.id
  mergeRequest.mergedAt = commit.createdAt
  return commit
}

function checkReproducibility(repository) {
  const paths = Object.keys(repository.files)
  const checks = [
    { name: "metadata", passed: Boolean(repository.metadata.authors.length && repository.metadata.schemaOrg) },
    { name: "raw-data", passed: paths.some((path) => path.startsWith("data/")) },
    { name: "analysis-code", passed: paths.some((path) => path.startsWith("code/") || path.startsWith("notebooks/")) },
    { name: "results", passed: paths.some((path) => path.startsWith("results/")) },
    {
      name: "environment",
      passed: paths.some((path) => ["Dockerfile", "environment.yml", "requirements.txt", "code/package.json"].includes(path)),
    },
    {
      name: "pipeline",
      passed: paths.some((path) => path.includes("run_analysis") || path.includes("reproduce")),
    },
  ]
  return {
    passed: checks.every((check) => check.passed),
    checks,
  }
}

function createExportManifest(repository) {
  return {
    repositoryId: repository.id,
    title: repository.title,
    head: repository.branches.main.head,
    files: Object.values(repository.files).map(({ path, contentHash, mediaType }) => ({ path, contentHash, mediaType })),
    metadata: repository.metadata,
    tags: repository.tags,
    generatedAt: new Date().toISOString(),
    manifestHash: hashContent({
      files: repository.files,
      metadata: repository.metadata,
      tags: repository.tags,
    }),
  }
}

function generateCitation(repository, tagName = null, style = "apa", doi = repository.metadata.doi) {
  const authors = repository.metadata.authors.map((author) => author.name).join(", ") || "Unknown authors"
  const year = new Date(repository.createdAt).getUTCFullYear()
  const version = tagName ? ` (${tagName})` : ""
  if (style === "bibtex") {
    return `@misc{${repository.id}, title={${repository.title}${version}}, author={${authors}}, year={${year}}, doi={${doi || ""}}}`
  }
  if (style === "mla") {
    return `${authors}. "${repository.title}${version}." SCIBASE, ${year}${doi ? `, doi:${doi}` : ""}.`
  }
  return `${authors}. (${year}). ${repository.title}${version}. SCIBASE.${doi ? ` https://doi.org/${doi}` : ""}`
}

function createApiContract(repositoryId) {
  return {
    basePath: `/api/projects/${repositoryId}`,
    endpoints: [
      "GET /api/projects/:id",
      "POST /api/projects",
      "PUT /api/projects/:id/files/:path",
      "POST /api/projects/:id/commits",
      "POST /api/projects/:id/forks",
      "POST /api/projects/:id/merge-requests",
      "POST /api/projects/:id/tags",
      "GET /api/projects/:id/export",
    ],
  }
}

function createCliContract(repositoryId) {
  return {
    commands: [
      `scibase repo clone ${repositoryId}`,
      `scibase repo commit ${repositoryId} --message "update analysis"`,
      `scibase repo tag ${repositoryId} preprint-v1.0`,
      `scibase repo export ${repositoryId} --format zip`,
    ],
  }
}

function requiredString(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

function ensureBranch(repository, name) {
  if (!repository.branches[name]) {
    throw new Error(`Unknown branch: ${name}`)
  }
}

function assertCommitExists(repository, commitId) {
  if (commitId === null || commitId === undefined) {
    return
  }
  if (!repository.commits.some((commit) => commit.id === commitId)) {
    throw new Error(`Unknown commit: ${commitId}`)
  }
}

function normalizeChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error("changes must include at least one file update")
  }
  return changes.map((change) => ({
    path: requiredString(change.path, "change.path"),
    content: change.content,
    mediaType: change.mediaType,
  }))
}

function validateComponentPath(change) {
  const valid = REQUIRED_COMPONENTS.some((component) =>
    component.path.endsWith("/") ? change.path.startsWith(component.path) : change.path === component.path,
  )
  if (!valid && !["Dockerfile", "environment.yml", "requirements.txt"].includes(change.path)) {
    throw new Error(`File is outside the scientific repository structure: ${change.path}`)
  }
}

function inferMediaType(path) {
  if (path.endsWith(".md")) return "text/markdown"
  if (path.endsWith(".tex")) return "application/x-tex"
  if (path.endsWith(".csv")) return "text/csv"
  if (path.endsWith(".json")) return "application/json"
  if (path.endsWith(".ipynb")) return "application/x-ipynb+json"
  return "application/octet-stream"
}

function getEditorCapabilities(path) {
  const extension = Object.keys(EDITOR_CAPABILITIES).find((candidate) => path.endsWith(candidate))
  return extension ? EDITOR_CAPABILITIES[extension] : ["binary-viewer", "hash-diff"]
}

module.exports = {
  REQUIRED_COMPONENTS,
  EDITOR_CAPABILITIES,
  checkReproducibility,
  createApiContract,
  createBranch,
  createCliContract,
  createCommit,
  createExportManifest,
  createMergeRequest,
  createRepository,
  forkRepository,
  generateCitation,
  hashContent,
  mergeRequest,
  rollbackBranch,
  tagVersion,
}
