# Issue #11 Requirements Map

This file maps the User and Project Management bounty requirements to concrete artifacts.

## 1. Authentication and Identity

- `registerUser()` stores email/password login state.
- `enableTwoFactor()` records 2FA enrollment.
- `linkIdentityProvider()` links ORCID, Google, GitHub, and LinkedIn identities.
- `registerInstitution()` records SAML-backed institutional login configuration.
- `createAnonymousUser()` supports open peer review and public browsing.

## 2. Researcher Profiles

- `registerUser()` creates profile fields for name, institution, field, bio, keywords, photo, and visibility.
- `syncOrcidProfile()` imports publications, affiliations, and grants.
- `setProfileVisibility()` switches public/private profile modes.
- `recordProjectActivity()` adds recent work to the profile activity feed.
- `recordProfileMetric()` updates downloads, forks, endorsements, and reproducibility score.
- `profile.metrics` stores downloads, forks, endorsements, and reproducibility score.
- Tests assert ORCID sync and anonymous/private visibility behavior.

## 3. Project Spaces

- `createProjectSpace()` creates scientific workspaces with documents, code, datasets, discussions, metadata, and citations.
- `AUTHORING_FORMATS` covers Markdown, LaTeX, and Jupyter authoring.
- `archiveProject()` records project archival state and reason.

## 4. Permissions and Access Control

- `ACCESS_ROLES` defines Owner, Admin, Contributor, Reviewer, and Viewer.
- `inviteCollaborator()` supports external collaborators with expiration and read-only flags.
- `grantProjectRole()` manages role-based project membership.
- `setObjectPermission()` allows object-level restrictions such as allowing reads while blocking raw data downloads.
- `resolveObjectAccess()` evaluates object-level permissions and project visibility.
- `recordObjectAccess()` captures allowed and denied access decisions in the project audit log.
- Project audit logs capture role, invite, share, archive, access, and activity history.

## Validation

Run from `user-project-management/`:

```bash
npm test
npm run demo
```
