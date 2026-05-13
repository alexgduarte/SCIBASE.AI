const assert = require("assert")

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
  rollbackBranch,
  tagVersion,
} = require("../src/repositoryVersionControl")

function buildRepository() {
  return createRepository({
    id: "test-repo",
    title: "Test Repository",
    authors: [{ name: "Test Author", orcid: "0000-0000-0000-0000" }],
    affiliations: ["SCIBASE Test Lab"],
    funding: ["Grant-1"],
    tags: ["test"],
  })
}

const repo = buildRepository()

assert.deepStrictEqual(repo.structure.map((component) => component.path), [
  "manuscript/",
  "data/",
  "code/",
  "notebooks/",
  "results/",
  "protocols/",
  "metadata.json",
])

const commit = createCommit(repo, {
  author: "Test Author",
  message: "Add reproducible assets",
  changes: [
    { path: "manuscript/preprint.md", content: "# Test" },
    { path: "data/raw.csv", content: "id,value\n1,42" },
    { path: "code/run_analysis.py", content: "print(42)" },
    { path: "notebooks/run_analysis.ipynb", content: "{}" },
    { path: "results/table.csv", content: "metric,value\nauc,0.9" },
    { path: "protocols/protocol.md", content: "# Protocol" },
    { path: "Dockerfile", content: "FROM python:3.12-slim" },
  ],
})

assert.strictEqual(repo.branches.main.head, commit.id)
assert.ok(repo.files["data/raw.csv"].contentHash)
assert.deepStrictEqual(repo.files["notebooks/run_analysis.ipynb"].editorCapabilities, ["notebook-editor", "cell-output-diff"])

createBranch(repo, "replication", commit.id)
const branchCommit = createCommit(repo, {
  branch: "replication",
  author: "Reviewer",
  message: "Add replication code",
  changes: [{ path: "code/replicate.py", content: "print('replicate')" }],
})
assert.strictEqual(repo.branches.replication.head, branchCommit.id)

const mergeRequestRecord = createMergeRequest(repo, {
  sourceBranch: "replication",
  targetBranch: "main",
  title: "Merge replication code",
  author: "Reviewer",
})
const mergeCommit = mergeRequest(repo, mergeRequestRecord.id, "Maintainer")
assert.strictEqual(mergeRequestRecord.status, "merged")
assert.strictEqual(repo.branches.main.head, mergeCommit.id)

rollbackBranch(repo, "main", commit.id)
assert.strictEqual(repo.branches.main.head, commit.id)

const tag = tagVersion(repo, {
  name: "preprint-v1.0",
  commitId: commit.id,
  doi: "10.5555/scibase.test-repo.v1",
})
assert.strictEqual(tag.name, "preprint-v1.0")
assert.match(tag.citation, /10\.5555/)

const fork = forkRepository(repo, {
  forkId: "test-repo-replication",
  owner: "Replication Lab",
})
assert.strictEqual(fork.sourceRepositoryId, repo.id)
assert.strictEqual(fork.attribution[0].name, "Test Author")

const reproducibility = checkReproducibility(repo)
assert.strictEqual(reproducibility.passed, true)

const manifest = createExportManifest(repo)
assert.strictEqual(manifest.repositoryId, repo.id)
assert.ok(manifest.manifestHash)
assert.ok(manifest.files.some((file) => file.path === "code/run_analysis.py"))

assert.match(generateCitation(repo, "preprint-v1.0", "bibtex"), /@misc/)

assert.throws(() => {
  createCommit(repo, {
    author: "Test Author",
    message: "Invalid location",
    changes: [{ path: "random/file.txt", content: "nope" }],
  })
}, /outside the scientific repository structure/)

console.log("project repository version-control tests passed")
