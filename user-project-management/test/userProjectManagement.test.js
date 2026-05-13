const assert = require("assert")

const {
  ACCESS_ROLES,
  AUTHORING_FORMATS,
  OBJECT_ACTIONS,
  createAnonymousUser,
  createPlatformState,
  createProjectSpace,
  createTimeLimitedShare,
  enableTwoFactor,
  grantProjectRole,
  inviteCollaborator,
  linkIdentityProvider,
  recordProfileMetric,
  recordObjectAccess,
  recordProjectActivity,
  registerInstitution,
  registerUser,
  resolveObjectAccess,
  setProfileVisibility,
  setObjectPermission,
  syncOrcidProfile,
  archiveProject,
} = require("../src/userProjectManagement")

const state = createPlatformState()

registerInstitution(state, {
  id: "oxford",
  name: "University of Oxford",
  samlEntityId: "https://sso.ox.ac.uk/saml",
  verifiedDomains: ["ox.ac.uk"],
})

const owner = registerUser(state, {
  email: "researcher@ox.ac.uk",
  passwordHash: "hash:researcher",
  name: "Dr. Ada Researcher",
  institutionId: "oxford",
  fields: ["neuroscience", "biostatistics"],
  keywords: ["reproducibility", "cohorts"],
})

assert.strictEqual(owner.identity.emailVerified, false)
assert.deepStrictEqual(owner.identity.loginMethods.emailPassword, {
  enabled: true,
  passwordHash: "hash:researcher",
})

enableTwoFactor(state, owner.id, { method: "totp", secretId: "vault:totp:ada" })
linkIdentityProvider(state, owner.id, { provider: "ORCID", subject: "0000-0001-2345-6789" })
linkIdentityProvider(state, owner.id, { provider: "GitHub", subject: "ada-lab" })

assert.strictEqual(owner.identity.twoFactor.enabled, true)
assert.strictEqual(owner.identity.providers.ORCID.subject, "0000-0001-2345-6789")
assert.ok(owner.auditLog.some((entry) => entry.action === "identity.provider_linked"))

syncOrcidProfile(state, owner.id, {
  publications: ["doi:10.1000/example"],
  affiliations: ["University of Oxford"],
  grants: ["Grant-123"],
})

assert.deepStrictEqual(owner.profile.publications, ["doi:10.1000/example"])
assert.deepStrictEqual(owner.profile.affiliations, ["University of Oxford"])
assert.deepStrictEqual(owner.profile.grants, ["Grant-123"])

setProfileVisibility(state, owner.id, "private")
assert.strictEqual(owner.profile.visibility, "private")

recordProfileMetric(state, owner.id, { metric: "downloads", delta: 12, source: "project-export" })
recordProfileMetric(state, owner.id, { metric: "endorsements", delta: 2, source: "peer-review" })
recordProfileMetric(state, owner.id, { metric: "reproducibilityScore", value: 91, source: "validated-run" })

assert.deepStrictEqual(owner.profile.metrics, {
  downloads: 12,
  forks: 0,
  endorsements: 2,
  reproducibilityScore: 91,
})

const anonymous = createAnonymousUser(state, { reason: "open peer review" })
assert.strictEqual(anonymous.identity.anonymous, true)
assert.strictEqual(anonymous.profile.visibility, "anonymous")

const project = createProjectSpace(state, {
  id: "alzheimers-cohort",
  ownerId: owner.id,
  title: "Alzheimer's Cohort Reproducibility",
  visibility: "institutional-only",
  fundingSources: ["Grant-123"],
  institutions: ["oxford"],
  citations: ["doi:10.1000/example"],
})

assert.deepStrictEqual(project.authoringFormats, AUTHORING_FORMATS)
assert.deepStrictEqual(Object.keys(project.workspace), [
  "documents",
  "code",
  "datasets",
  "discussions",
  "metadata",
  "citations",
])
assert.strictEqual(project.members[owner.id].role, ACCESS_ROLES.owner)

const collaborator = registerUser(state, {
  email: "reviewer@example.edu",
  passwordHash: "hash:reviewer",
  name: "External Reviewer",
})

const invite = inviteCollaborator(state, project.id, {
  invitedBy: owner.id,
  email: collaborator.identity.email,
  role: ACCESS_ROLES.reviewer,
  expiresAt: "2026-06-01T00:00:00.000Z",
  readOnly: true,
})

grantProjectRole(state, project.id, {
  actorId: owner.id,
  userId: collaborator.id,
  role: ACCESS_ROLES.reviewer,
})

assert.strictEqual(invite.readOnly, true)
assert.strictEqual(project.members[collaborator.id].role, ACCESS_ROLES.reviewer)

setObjectPermission(state, project.id, {
  actorId: owner.id,
  objectPath: "code/run_analysis.py",
  role: ACCESS_ROLES.contributor,
  actions: [OBJECT_ACTIONS.read, OBJECT_ACTIONS.edit],
})

setObjectPermission(state, project.id, {
  actorId: owner.id,
  objectPath: "datasets/raw.csv",
  role: ACCESS_ROLES.reviewer,
  actions: [OBJECT_ACTIONS.read],
})

assert.strictEqual(resolveObjectAccess(state, project.id, {
  userId: collaborator.id,
  objectPath: "datasets/raw.csv",
  action: OBJECT_ACTIONS.download,
}), false)

assert.strictEqual(resolveObjectAccess(state, project.id, {
  userId: collaborator.id,
  objectPath: "datasets/raw.csv",
  action: OBJECT_ACTIONS.read,
}), true)

const deniedDownload = recordObjectAccess(state, project.id, {
  userId: collaborator.id,
  objectPath: "datasets/raw.csv",
  action: OBJECT_ACTIONS.download,
})

assert.strictEqual(deniedDownload.details.allowed, false)
assert.ok(project.auditLog.some((entry) => entry.action === "project.object_access_denied"))

const share = createTimeLimitedShare(state, project.id, {
  actorId: owner.id,
  targetEmail: "partner@lab.example",
  objectPath: "documents/preprint.md",
  actions: [OBJECT_ACTIONS.read],
  expiresAt: "2026-05-20T00:00:00.000Z",
})

assert.strictEqual(share.objectPath, "documents/preprint.md")
assert.strictEqual(share.actions[0], OBJECT_ACTIONS.read)

recordProjectActivity(state, project.id, {
  actorId: collaborator.id,
  action: "review.submitted",
  target: "documents/preprint.md",
})

assert.ok(project.auditLog.some((entry) => entry.action === "project.role_granted"))
assert.ok(project.auditLog.some((entry) => entry.action === "review.submitted"))
assert.ok(collaborator.profile.activityFeed.some((entry) => entry.action === "review.submitted"))
assert.ok(owner.profile.activityFeed.some((entry) => entry.action === "project.created"))

archiveProject(state, project.id, { actorId: owner.id, reason: "superseded by published study" })
assert.strictEqual(project.status, "archived")

assert.throws(() => {
  grantProjectRole(state, project.id, {
    actorId: collaborator.id,
    userId: anonymous.id,
    role: ACCESS_ROLES.contributor,
  })
}, /requires Owner or Admin/)

console.log("user and project management tests passed")
