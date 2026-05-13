const {
  ACCESS_ROLES,
  OBJECT_ACTIONS,
  createPlatformState,
  createProjectSpace,
  createTimeLimitedShare,
  enableTwoFactor,
  grantProjectRole,
  inviteCollaborator,
  linkIdentityProvider,
  recordObjectAccess,
  recordProfileMetric,
  registerInstitution,
  registerUser,
  resolveObjectAccess,
  setProfileVisibility,
  setObjectPermission,
  syncOrcidProfile,
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
  fields: ["neuroscience"],
  keywords: ["reproducibility"],
})

enableTwoFactor(state, owner.id, { method: "totp", secretId: "vault:totp:ada" })
linkIdentityProvider(state, owner.id, { provider: "ORCID", subject: "0000-0001-2345-6789" })
syncOrcidProfile(state, owner.id, {
  publications: ["doi:10.1000/example"],
  affiliations: ["University of Oxford"],
  grants: ["Grant-123"],
})
setProfileVisibility(state, owner.id, "private")
recordProfileMetric(state, owner.id, { metric: "downloads", delta: 12, source: "project-export" })

const project = createProjectSpace(state, {
  id: "alzheimers-cohort",
  ownerId: owner.id,
  title: "Alzheimer's Cohort Reproducibility",
  visibility: "institutional-only",
  fundingSources: ["Grant-123"],
  institutions: ["oxford"],
  citations: ["doi:10.1000/example"],
})

const reviewer = registerUser(state, {
  email: "reviewer@example.edu",
  passwordHash: "hash:reviewer",
  name: "External Reviewer",
})

inviteCollaborator(state, project.id, {
  invitedBy: owner.id,
  email: reviewer.identity.email,
  role: ACCESS_ROLES.reviewer,
  expiresAt: "2026-06-01T00:00:00.000Z",
  readOnly: true,
})

grantProjectRole(state, project.id, {
  actorId: owner.id,
  userId: reviewer.id,
  role: ACCESS_ROLES.reviewer,
})

setObjectPermission(state, project.id, {
  actorId: owner.id,
  objectPath: "datasets/raw.csv",
  role: ACCESS_ROLES.reviewer,
  actions: [OBJECT_ACTIONS.read],
})

const share = createTimeLimitedShare(state, project.id, {
  actorId: owner.id,
  targetEmail: "partner@lab.example",
  objectPath: "documents/preprint.md",
  actions: [OBJECT_ACTIONS.read],
  expiresAt: "2026-05-20T00:00:00.000Z",
})

const deniedDownload = recordObjectAccess(state, project.id, {
  userId: reviewer.id,
  objectPath: "datasets/raw.csv",
  action: OBJECT_ACTIONS.download,
})

console.log(JSON.stringify({
  users: Object.keys(state.users).length,
  institutions: Object.keys(state.institutions).length,
  project: {
    id: project.id,
    visibility: project.visibility,
    members: project.members,
    workspaceSections: Object.keys(project.workspace),
  },
  ownerProfile: {
    visibility: owner.profile.visibility,
    metrics: owner.profile.metrics,
    recentActivity: owner.profile.activityFeed,
  },
  reviewerCanReadRawData: resolveObjectAccess(state, project.id, {
    userId: reviewer.id,
    objectPath: "datasets/raw.csv",
    action: OBJECT_ACTIONS.read,
  }),
  reviewerCanDownloadRawData: resolveObjectAccess(state, project.id, {
    userId: reviewer.id,
    objectPath: "datasets/raw.csv",
    action: OBJECT_ACTIONS.download,
  }),
  share,
  deniedDownload,
  auditEvents: project.auditLog.map((entry) => entry.action),
}, null, 2))
