# Issue #10 Requirements Map

This file maps the Project Repository and Version Control bounty requirements to concrete artifacts.

## 1. Repository Structure and Components

- `src/repositoryVersionControl.js`: `REQUIRED_COMPONENTS`
- `schema/project-repository.schema.json`: `structure` schema
- `test/repositoryVersionControl.test.js`: asserts all required component paths

Covered components:

- `manuscript/`
- `data/`
- `code/`
- `notebooks/`
- `results/`
- `protocols/`
- `metadata.json`

## 2. File and Metadata Versioning

- `createCommit()` records commit history, branch, parent commit, author, message, content hashes, and changed paths.
- `rollbackBranch()` moves a branch head back to a known commit.
- `tagVersion()` records semantic/preprint versions and DOI metadata.
- `hashContent()` provides SHA-256 integrity tracking.
- Git LFS production note is documented in `README.md`.

## 3. Collaboration and Forking

- `forkRepository()` records downstream derivation and attribution.
- `createBranch()` supports parallel hypotheses and experiments.
- `createMergeRequest()` tracks source/target branch, discussion, reviewers, and provenance.
- `mergeRequest()` records merge review and merge commit metadata.

## 4. In-Browser Editors and Diffs

- `EDITOR_CAPABILITIES` maps file extensions to editing and diff capabilities.
- Supported file families include Markdown, LaTeX, CSV, JSON, Jupyter notebooks, Python, R, and Julia.
- Tests assert notebook diff capability metadata.

## 5. Computation-Aware Reproducibility

- `checkReproducibility()` validates metadata, raw data, analysis code/notebooks, results, environment files, and pipelines.
- `demo/demo.js` demonstrates a reproducible repository with data, analysis code, notebook, result, protocol, and environment file.
- `test/repositoryVersionControl.test.js` asserts reproducibility passes for a complete project.

## 6. Repository Identifiers and Citation

- Repository metadata supports repository-level DOI.
- `tagVersion()` supports version-level DOI.
- `generateCitation()` supports APA-like, MLA-like, and BibTeX citations.
- `metadata.schemaOrg` records schema.org dataset metadata.

## 7. Programmatic Access and Export

- `createApiContract()` defines REST endpoints for project, file, commit, fork, merge request, tag, and export access.
- `createCliContract()` defines Git-compatible CLI command shapes.
- `createExportManifest()` emits a zipped-bundle-ready manifest with files, hashes, tags, metadata, and manifest hash.

## Validation

Run from `project-repository-version-control/`:

```bash
npm test
npm run demo
```
