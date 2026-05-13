# User and Project Management

This module implements an MVP reference design for SCIBASE user identity, researcher profiles, scientific project spaces, and project-level access control. It is dependency-free and can be run with Node.js.

## What This Provides

- Email/password authentication state with 2FA setup.
- OAuth-style account linking for ORCID, Google, GitHub, and LinkedIn.
- SAML-backed institutional login records.
- Anonymous user mode for open peer review and public browsing.
- Researcher profiles with ORCID sync for publications, affiliations, and grants.
- Public/private profile controls, activity feeds, and reputation metrics.
- Scientific project spaces with documents, code, datasets, discussions, metadata, and citations.
- Role-based access control for Owner, Admin, Contributor, Reviewer, and Viewer.
- Fine-grained object permissions for cases like code editing without raw-data downloads.
- Time-limited external sharing and invitation records.
- Project audit logs for access decisions, role changes, invitations, and activity history.

## Layout

```text
user-project-management/
  demo/demo.js
  schema/user-project-management.schema.json
  src/userProjectManagement.js
  test/userProjectManagement.test.js
  requirements-map.md
```

## Run

```bash
npm test
npm run demo
```

No external services or packages are required.

## Example

```js
const {
  createPlatformState,
  createProjectSpace,
  recordObjectAccess,
  registerUser,
  setProfileVisibility,
} = require("./src/userProjectManagement")

const state = createPlatformState()
const owner = registerUser(state, {
  email: "researcher@example.edu",
  passwordHash: "hash",
  name: "Dr. Ada Researcher",
})

const project = createProjectSpace(state, {
  id: "alzheimers-cohort",
  ownerId: owner.id,
  title: "Alzheimer's Cohort Reproducibility",
  visibility: "private",
})

setProfileVisibility(state, owner.id, "private")

recordObjectAccess(state, project.id, {
  userId: owner.id,
  objectPath: "documents/preprint.md",
  action: "read",
})
```

## Design Notes

This implementation keeps all state in a plain JavaScript object so the domain model and permission decisions can be reviewed quickly. A production backend can persist the same entities in a relational database, move secrets to a vault, and delegate authentication to hardened providers while keeping the project governance model intact.
