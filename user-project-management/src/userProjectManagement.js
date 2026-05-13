const ACCESS_ROLES = {
  owner: "Owner",
  admin: "Admin",
  contributor: "Contributor",
  reviewer: "Reviewer",
  viewer: "Viewer",
}

const ROLE_RANK = {
  [ACCESS_ROLES.owner]: 5,
  [ACCESS_ROLES.admin]: 4,
  [ACCESS_ROLES.contributor]: 3,
  [ACCESS_ROLES.reviewer]: 2,
  [ACCESS_ROLES.viewer]: 1,
}

const OBJECT_ACTIONS = {
  read: "read",
  edit: "edit",
  comment: "comment",
  download: "download",
  manage: "manage",
}

const AUTHORING_FORMATS = ["Markdown", "LaTeX", "Jupyter Notebooks"]

const SUPPORTED_IDENTITY_PROVIDERS = ["ORCID", "Google", "GitHub", "LinkedIn"]

function createPlatformState() {
  return {
    users: {},
    institutions: {},
    projects: {},
    auditLog: [],
    counters: {
      users: 1,
      institutions: 1,
      projects: 1,
      invites: 1,
      shares: 1,
      audit: 1,
    },
  }
}

function registerInstitution(state, input) {
  const id = input.id || `institution-${state.counters.institutions++}`
  const institution = {
    id,
    name: requiredString(input.name, "name"),
    samlEntityId: requiredString(input.samlEntityId, "samlEntityId"),
    verifiedDomains: input.verifiedDomains || [],
    loginMethod: {
      type: "SAML",
      enabled: true,
    },
    createdAt: timestamp(),
  }
  state.institutions[id] = institution
  appendAudit(state, "institution.registered", id, { institutionId: id })
  return institution
}

function registerUser(state, input) {
  const id = input.id || `user-${state.counters.users++}`
  const institution = input.institutionId ? state.institutions[input.institutionId] : null
  if (input.institutionId && !institution) {
    throw new Error(`Unknown institution: ${input.institutionId}`)
  }

  const user = {
    id,
    identity: {
      email: requiredString(input.email, "email"),
      emailVerified: Boolean(input.emailVerified),
      anonymous: false,
      loginMethods: {
        emailPassword: {
          enabled: true,
          passwordHash: requiredString(input.passwordHash, "passwordHash"),
        },
        saml: institution
          ? {
              enabled: true,
              institutionId: institution.id,
              entityId: institution.samlEntityId,
            }
          : null,
      },
      providers: {},
      twoFactor: {
        enabled: false,
        methods: [],
      },
    },
    profile: {
      name: requiredString(input.name, "name"),
      institutionId: input.institutionId || null,
      fields: input.fields || [],
      bio: input.bio || "",
      keywords: input.keywords || [],
      photoUrl: input.photoUrl || null,
      visibility: input.profileVisibility || "public",
      publications: [],
      affiliations: [],
      grants: [],
      metrics: {
        downloads: 0,
        forks: 0,
        endorsements: 0,
        reproducibilityScore: 0,
      },
      activityFeed: [],
    },
    auditLog: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }

  state.users[id] = user
  appendUserAudit(state, user, "user.registered", id, { email: user.identity.email })
  return user
}

function createAnonymousUser(state, input = {}) {
  const id = input.id || `anonymous-${state.counters.users++}`
  const user = {
    id,
    identity: {
      email: null,
      emailVerified: false,
      anonymous: true,
      loginMethods: {},
      providers: {},
      twoFactor: {
        enabled: false,
        methods: [],
      },
    },
    profile: {
      name: input.displayName || "Anonymous reviewer",
      institutionId: null,
      fields: [],
      bio: "",
      keywords: [],
      photoUrl: null,
      visibility: "anonymous",
      publications: [],
      affiliations: [],
      grants: [],
      metrics: {
        downloads: 0,
        forks: 0,
        endorsements: 0,
        reproducibilityScore: 0,
      },
      activityFeed: [],
      anonymousReason: input.reason || "public browsing",
    },
    auditLog: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.users[id] = user
  appendUserAudit(state, user, "user.anonymous_created", id, { reason: user.profile.anonymousReason })
  return user
}

function enableTwoFactor(state, userId, input) {
  const user = requireUser(state, userId)
  const method = {
    method: requiredString(input.method, "method"),
    secretId: requiredString(input.secretId, "secretId"),
    enabledAt: timestamp(),
  }
  user.identity.twoFactor.enabled = true
  user.identity.twoFactor.methods.push(method)
  user.updatedAt = timestamp()
  appendUserAudit(state, user, "identity.two_factor_enabled", userId, { method: method.method })
  return user.identity.twoFactor
}

function linkIdentityProvider(state, userId, input) {
  const user = requireUser(state, userId)
  const provider = requiredString(input.provider, "provider")
  if (!SUPPORTED_IDENTITY_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported identity provider: ${provider}`)
  }
  user.identity.providers[provider] = {
    provider,
    subject: requiredString(input.subject, "subject"),
    linkedAt: timestamp(),
  }
  if (provider === "ORCID") {
    user.profile.orcid = input.subject
  }
  user.updatedAt = timestamp()
  appendUserAudit(state, user, "identity.provider_linked", userId, { provider })
  return user.identity.providers[provider]
}

function syncOrcidProfile(state, userId, input) {
  const user = requireUser(state, userId)
  if (!user.identity.providers.ORCID) {
    throw new Error("ORCID must be linked before profile sync")
  }
  user.profile.publications = input.publications || []
  user.profile.affiliations = input.affiliations || []
  user.profile.grants = input.grants || []
  user.profile.orcidSyncedAt = timestamp()
  user.updatedAt = timestamp()
  appendUserAudit(state, user, "profile.orcid_synced", userId, {
    publications: user.profile.publications.length,
    grants: user.profile.grants.length,
  })
  return user.profile
}

function setProfileVisibility(state, userId, visibility) {
  const user = requireUser(state, userId)
  if (!["public", "private", "anonymous"].includes(visibility)) {
    throw new Error(`Unknown profile visibility: ${visibility}`)
  }
  user.profile.visibility = visibility
  user.updatedAt = timestamp()
  appendUserAudit(state, user, "profile.visibility_changed", userId, { visibility })
  return user.profile
}

function recordProfileMetric(state, userId, input) {
  const user = requireUser(state, userId)
  const metric = requiredString(input.metric, "metric")
  if (!Object.prototype.hasOwnProperty.call(user.profile.metrics, metric)) {
    throw new Error(`Unknown profile metric: ${metric}`)
  }
  if (typeof input.value === "number") {
    user.profile.metrics[metric] = input.value
  } else {
    user.profile.metrics[metric] += Number(input.delta || 0)
  }
  user.updatedAt = timestamp()
  appendUserAudit(state, user, "profile.metric_recorded", userId, {
    metric,
    value: user.profile.metrics[metric],
    source: input.source || null,
  })
  return user.profile.metrics
}

function createProjectSpace(state, input) {
  const owner = requireUser(state, input.ownerId)
  const id = input.id || `project-${state.counters.projects++}`
  const project = {
    id,
    title: requiredString(input.title, "title"),
    status: "active",
    visibility: input.visibility || "private",
    ownerId: owner.id,
    institutions: input.institutions || [],
    fundingSources: input.fundingSources || [],
    authoringFormats: AUTHORING_FORMATS,
    workspace: {
      documents: input.documents || [],
      code: input.code || [],
      datasets: input.datasets || [],
      discussions: input.discussions || [],
      metadata: {
        title: input.title,
        fundingSources: input.fundingSources || [],
        institutions: input.institutions || [],
      },
      citations: input.citations || [],
    },
    members: {
      [owner.id]: {
        userId: owner.id,
        role: ACCESS_ROLES.owner,
        addedAt: timestamp(),
        addedBy: owner.id,
      },
    },
    invitations: [],
    objectPermissions: {},
    shares: [],
    auditLog: [],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.projects[id] = project
  appendProjectAudit(state, project, "project.created", owner.id, { visibility: project.visibility })
  appendProfileActivity(owner, {
    projectId: project.id,
    action: "project.created",
    target: project.title,
  })
  return project
}

function inviteCollaborator(state, projectId, input) {
  const project = requireProject(state, projectId)
  requireProjectManager(project, input.invitedBy)
  const invite = {
    id: `invite-${state.counters.invites++}`,
    email: requiredString(input.email, "email"),
    role: requiredRole(input.role),
    readOnly: Boolean(input.readOnly),
    expiresAt: requiredString(input.expiresAt, "expiresAt"),
    invitedBy: input.invitedBy,
    createdAt: timestamp(),
    status: "pending",
  }
  project.invitations.push(invite)
  project.updatedAt = timestamp()
  appendProjectAudit(state, project, "project.collaborator_invited", input.invitedBy, {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  })
  return invite
}

function grantProjectRole(state, projectId, input) {
  const project = requireProject(state, projectId)
  requireProjectManager(project, input.actorId)
  requireUser(state, input.userId)
  const role = requiredRole(input.role)
  project.members[input.userId] = {
    userId: input.userId,
    role,
    addedAt: timestamp(),
    addedBy: input.actorId,
  }
  project.updatedAt = timestamp()
  appendProfileActivity(requireUser(state, input.userId), {
    projectId,
    action: "project.role_granted",
    target: role,
  })
  appendProjectAudit(state, project, "project.role_granted", input.actorId, {
    userId: input.userId,
    role,
  })
  return project.members[input.userId]
}

function setObjectPermission(state, projectId, input) {
  const project = requireProject(state, projectId)
  requireProjectManager(project, input.actorId)
  const role = requiredRole(input.role)
  const objectPath = requiredString(input.objectPath, "objectPath")
  const actions = uniqueActions(input.actions || [])

  project.objectPermissions[objectPath] = project.objectPermissions[objectPath] || {}
  project.objectPermissions[objectPath][role] = actions
  project.updatedAt = timestamp()
  appendProjectAudit(state, project, "project.object_permission_set", input.actorId, {
    objectPath,
    role,
    actions,
  })
  return project.objectPermissions[objectPath][role]
}

function resolveObjectAccess(state, projectId, input) {
  const project = requireProject(state, projectId)
  const user = input.userId ? state.users[input.userId] : null
  const action = requiredString(input.action, "action")
  const objectPath = requiredString(input.objectPath, "objectPath")
  const member = user ? project.members[user.id] : null

  if (!member) {
    return resolveVisibilityAccess(project, user, action)
  }

  const role = member.role
  const explicitActions = project.objectPermissions[objectPath]?.[role]
  if (explicitActions) {
    return explicitActions.includes(action)
  }

  return defaultActionsForRole(role).includes(action)
}

function recordObjectAccess(state, projectId, input) {
  const project = requireProject(state, projectId)
  const allowed = resolveObjectAccess(state, projectId, input)
  return appendProjectAudit(
    state,
    project,
    allowed ? "project.object_access_allowed" : "project.object_access_denied",
    input.userId || "anonymous",
    {
      objectPath: requiredString(input.objectPath, "objectPath"),
      action: requiredString(input.action, "action"),
      allowed,
    },
  )
}

function createTimeLimitedShare(state, projectId, input) {
  const project = requireProject(state, projectId)
  requireProjectManager(project, input.actorId)
  const share = {
    id: `share-${state.counters.shares++}`,
    targetEmail: requiredString(input.targetEmail, "targetEmail"),
    objectPath: requiredString(input.objectPath, "objectPath"),
    actions: uniqueActions(input.actions || [OBJECT_ACTIONS.read]),
    expiresAt: requiredString(input.expiresAt, "expiresAt"),
    createdBy: input.actorId,
    createdAt: timestamp(),
  }
  project.shares.push(share)
  project.updatedAt = timestamp()
  appendProjectAudit(state, project, "project.time_limited_share_created", input.actorId, {
    targetEmail: share.targetEmail,
    objectPath: share.objectPath,
    expiresAt: share.expiresAt,
  })
  return share
}

function recordProjectActivity(state, projectId, input) {
  const project = requireProject(state, projectId)
  const actorId = requiredString(input.actorId, "actorId")
  if (!project.members[actorId]) {
    throw new Error("Project activity requires a project member")
  }
  const entry = appendProjectAudit(state, project, requiredString(input.action, "action"), actorId, {
    target: input.target || null,
  })
  appendProfileActivity(requireUser(state, actorId), {
    projectId,
    action: input.action,
    target: input.target || null,
  })
  project.updatedAt = timestamp()
  return entry
}

function archiveProject(state, projectId, input) {
  const project = requireProject(state, projectId)
  requireProjectManager(project, input.actorId)
  project.status = "archived"
  project.archivedAt = timestamp()
  project.archiveReason = requiredString(input.reason, "reason")
  project.updatedAt = timestamp()
  appendProjectAudit(state, project, "project.archived", input.actorId, { reason: project.archiveReason })
  return project
}

function defaultActionsForRole(role) {
  if (role === ACCESS_ROLES.owner || role === ACCESS_ROLES.admin) {
    return Object.values(OBJECT_ACTIONS)
  }
  if (role === ACCESS_ROLES.contributor) {
    return [OBJECT_ACTIONS.read, OBJECT_ACTIONS.edit, OBJECT_ACTIONS.comment, OBJECT_ACTIONS.download]
  }
  if (role === ACCESS_ROLES.reviewer) {
    return [OBJECT_ACTIONS.read, OBJECT_ACTIONS.comment]
  }
  return [OBJECT_ACTIONS.read]
}

function resolveVisibilityAccess(project, user, action) {
  if (action !== OBJECT_ACTIONS.read) {
    return false
  }
  if (project.visibility === "public") {
    return true
  }
  if (project.visibility === "institutional-only" && user?.profile?.institutionId) {
    return project.institutions.includes(user.profile.institutionId)
  }
  return false
}

function requireProjectManager(project, actorId) {
  const member = project.members[actorId]
  if (!member || ROLE_RANK[member.role] < ROLE_RANK[ACCESS_ROLES.admin]) {
    throw new Error("Project management requires Owner or Admin role")
  }
  return member
}

function requireUser(state, userId) {
  const user = state.users[userId]
  if (!user) {
    throw new Error(`Unknown user: ${userId}`)
  }
  return user
}

function requireProject(state, projectId) {
  const project = state.projects[projectId]
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`)
  }
  return project
}

function requiredRole(role) {
  if (!Object.values(ACCESS_ROLES).includes(role)) {
    throw new Error(`Unknown role: ${role}`)
  }
  return role
}

function uniqueActions(actions) {
  const validActions = Object.values(OBJECT_ACTIONS)
  const unique = [...new Set(actions)]
  unique.forEach((action) => {
    if (!validActions.includes(action)) {
      throw new Error(`Unknown object action: ${action}`)
    }
  })
  return unique
}

function appendUserAudit(state, user, action, actorId, details = {}) {
  const entry = appendAudit(state, action, actorId, details)
  user.auditLog.push(entry)
  return entry
}

function appendProjectAudit(state, project, action, actorId, details = {}) {
  const entry = appendAudit(state, action, actorId, {
    projectId: project.id,
    ...details,
  })
  project.auditLog.push(entry)
  return entry
}

function appendProfileActivity(user, input) {
  user.profile.activityFeed.unshift({
    projectId: input.projectId,
    action: input.action,
    target: input.target,
    createdAt: timestamp(),
  })
}

function appendAudit(state, action, actorId, details = {}) {
  const entry = {
    id: `audit-${state.counters.audit++}`,
    action,
    actorId,
    details,
    createdAt: timestamp(),
  }
  state.auditLog.push(entry)
  return entry
}

function requiredString(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
  ACCESS_ROLES,
  AUTHORING_FORMATS,
  OBJECT_ACTIONS,
  SUPPORTED_IDENTITY_PROVIDERS,
  archiveProject,
  createAnonymousUser,
  createPlatformState,
  createProjectSpace,
  createTimeLimitedShare,
  enableTwoFactor,
  grantProjectRole,
  inviteCollaborator,
  linkIdentityProvider,
  recordObjectAccess,
  recordProfileMetric,
  recordProjectActivity,
  registerInstitution,
  registerUser,
  resolveObjectAccess,
  setProfileVisibility,
  setObjectPermission,
  syncOrcidProfile,
}
