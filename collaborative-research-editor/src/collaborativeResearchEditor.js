const crypto = require("crypto");

const BLOCK_TYPES = new Set([
  "markdown",
  "latex",
  "code",
  "notebook",
  "data",
  "figure",
  "protocol",
  "metadata",
]);

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
}

function validateBlock(block) {
  assertNonEmpty(block.id, "block.id");
  assertNonEmpty(block.type, "block.type");
  assertNonEmpty(block.section, "block.section");
  if (!BLOCK_TYPES.has(block.type)) {
    throw new Error(`Unsupported block type: ${block.type}`);
  }
  return {
    ...block,
    content: block.content ?? "",
    metadata: block.metadata ? { ...block.metadata } : {},
  };
}

function cloneDocument(document) {
  return {
    ...document,
    collaborators: document.collaborators.map((collaborator) => ({ ...collaborator })),
    blocks: document.blocks.map((block) => ({
      ...block,
      metadata: { ...block.metadata },
    })),
    versions: document.versions.map((version) => ({
      ...version,
      blockHashes: { ...version.blockHashes },
    })),
    comments: document.comments.map((comment) => ({ ...comment })),
    suggestions: document.suggestions.map((suggestion) => ({ ...suggestion })),
    tasks: document.tasks.map((task) => ({ ...task })),
    locks: document.locks.map((lock) => ({ ...lock })),
    presence: document.presence.map((entry) => ({
      ...entry,
      cursor: entry.cursor ? { ...entry.cursor } : null,
    })),
  };
}

function blockHashes(blocks) {
  return Object.fromEntries(blocks.map((block) => [block.id, stableHash(block)]));
}

function appendVersion(document, actorId, reason, payload = {}) {
  const nextIndex = document.versions.length + 1;
  const version = {
    id: `version-${nextIndex}-${stableHash({
      documentId: document.id,
      actorId,
      reason,
      payload,
      blocks: document.blocks,
    })}`,
    actorId,
    reason,
    sequence: nextIndex,
    blockHashes: blockHashes(document.blocks),
    payload,
  };
  document.versions.push(version);
  document.headVersionId = version.id;
  return document;
}

function createResearchDocument(input) {
  assertNonEmpty(input.id, "id");
  assertNonEmpty(input.title, "title");
  const document = {
    id: input.id,
    title: input.title,
    collaborators: (input.collaborators ?? []).map((collaborator) => ({ ...collaborator })),
    blocks: (input.blocks ?? []).map(validateBlock),
    versions: [],
    comments: [],
    suggestions: [],
    tasks: [],
    locks: [],
    presence: [],
    headVersionId: null,
  };
  return appendVersion(document, "system", "Create collaborative research document");
}

function findBlockIndex(document, blockId) {
  const index = document.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) {
    throw new Error(`Unknown block: ${blockId}`);
  }
  return index;
}

function assertActorCanEditSection(document, section, actorId) {
  const lock = document.locks.find((entry) => entry.section === section && entry.active);
  if (lock && lock.actorId !== actorId) {
    throw new Error(`Section "${section}" is locked by ${lock.actorId}`);
  }
}

function applyOperation(document, operation) {
  assertNonEmpty(operation.actorId, "operation.actorId");
  assertNonEmpty(operation.type, "operation.type");
  const next = cloneDocument(document);

  if (operation.type === "update-block") {
    const index = findBlockIndex(next, operation.blockId);
    assertActorCanEditSection(next, next.blocks[index].section, operation.actorId);
    next.blocks[index] = validateBlock({
      ...next.blocks[index],
      ...operation.patch,
      content: operation.content ?? operation.patch?.content ?? next.blocks[index].content,
    });
  } else if (operation.type === "insert-block") {
    const block = validateBlock(operation.block);
    assertActorCanEditSection(next, block.section, operation.actorId);
    const insertAfter = operation.afterBlockId ? findBlockIndex(next, operation.afterBlockId) + 1 : next.blocks.length;
    next.blocks.splice(insertAfter, 0, block);
  } else if (operation.type === "delete-block") {
    const index = findBlockIndex(next, operation.blockId);
    assertActorCanEditSection(next, next.blocks[index].section, operation.actorId);
    next.blocks.splice(index, 1);
  } else if (operation.type === "move-block") {
    const index = findBlockIndex(next, operation.blockId);
    assertActorCanEditSection(next, next.blocks[index].section, operation.actorId);
    const [block] = next.blocks.splice(index, 1);
    const insertAfter = operation.afterBlockId ? findBlockIndex(next, operation.afterBlockId) + 1 : 0;
    next.blocks.splice(insertAfter, 0, block);
  } else {
    throw new Error(`Unsupported operation type: ${operation.type}`);
  }

  return appendVersion(next, operation.actorId, operation.reason ?? `Apply ${operation.type}`, {
    type: operation.type,
    blockId: operation.blockId ?? operation.block?.id,
  });
}

function lockSection(document, input) {
  assertNonEmpty(input.section, "section");
  assertNonEmpty(input.actorId, "actorId");
  const next = cloneDocument(document);
  const existing = next.locks.find((lock) => lock.section === input.section && lock.active);
  if (existing && existing.actorId !== input.actorId) {
    throw new Error(`Section "${input.section}" is locked by ${existing.actorId}`);
  }
  if (!existing) {
    next.locks.push({
      id: `lock-${next.locks.length + 1}-${stableHash(input)}`,
      section: input.section,
      actorId: input.actorId,
      reason: input.reason ?? "Section locked for review",
      active: true,
    });
  }
  return appendVersion(next, input.actorId, input.reason ?? `Lock ${input.section}`, {
    section: input.section,
  });
}

function addComment(document, input) {
  findBlockIndex(document, input.blockId);
  const next = cloneDocument(document);
  const comment = {
    id: `comment-${next.comments.length + 1}-${stableHash(input)}`,
    actorId: input.actorId,
    blockId: input.blockId,
    text: input.text,
    status: "open",
  };
  next.comments.push(comment);
  return appendVersion(next, input.actorId, `Add comment on ${input.blockId}`, { commentId: comment.id });
}

function addSuggestion(document, input) {
  findBlockIndex(document, input.blockId);
  const next = cloneDocument(document);
  const suggestion = {
    id: `suggestion-${next.suggestions.length + 1}-${stableHash(input)}`,
    actorId: input.actorId,
    blockId: input.blockId,
    replacement: input.replacement,
    rationale: input.rationale,
    status: "open",
  };
  next.suggestions.push(suggestion);
  return appendVersion(next, input.actorId, `Add suggestion on ${input.blockId}`, {
    suggestionId: suggestion.id,
  });
}

function resolveSuggestion(document, input) {
  const next = cloneDocument(document);
  const suggestion = next.suggestions.find((entry) => entry.id === input.suggestionId);
  if (!suggestion) {
    throw new Error(`Unknown suggestion: ${input.suggestionId}`);
  }
  suggestion.status = input.status;
  suggestion.resolvedBy = input.actorId;
  return appendVersion(next, input.actorId, `${input.status} suggestion ${input.suggestionId}`, {
    suggestionId: input.suggestionId,
  });
}

function createTask(document, input) {
  findBlockIndex(document, input.blockId);
  const next = cloneDocument(document);
  const task = {
    id: `task-${next.tasks.length + 1}-${stableHash(input)}`,
    actorId: input.actorId,
    blockId: input.blockId,
    title: input.title,
    dueDate: input.dueDate ?? null,
    status: "open",
  };
  next.tasks.push(task);
  return appendVersion(next, input.actorId, `Create task ${task.title}`, { taskId: task.id });
}

function setPresence(document, input) {
  findBlockIndex(document, input.blockId);
  const next = cloneDocument(document);
  next.presence = next.presence.filter((entry) => entry.actorId !== input.actorId);
  next.presence.push({
    actorId: input.actorId,
    blockId: input.blockId,
    cursor: input.cursor ? { ...input.cursor } : null,
  });
  return appendVersion(next, input.actorId, `Set presence for ${input.actorId} on ${input.blockId}`, {
    blockId: input.blockId,
  });
}

function exportPublicationOutline(document) {
  const sections = [];
  for (const block of document.blocks) {
    if (!sections.includes(block.section)) {
      sections.push(block.section);
    }
  }

  return {
    documentId: document.id,
    title: document.title,
    headVersionId: document.headVersionId,
    collaborators: document.collaborators,
    sections,
    blocks: document.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      section: block.section,
      contentHash: stableHash(block),
    })),
    reviewItems: {
      comments: document.comments.filter((comment) => comment.status === "open").length,
      tasks: document.tasks.filter((task) => task.status === "open").length,
      acceptedSuggestions: document.suggestions.filter((suggestion) => suggestion.status === "accepted").length,
      openSuggestions: document.suggestions.filter((suggestion) => suggestion.status === "open").length,
    },
  };
}

function summarizeCollaborationState(document) {
  const latestVersion = document.versions[document.versions.length - 1] ?? null;
  return {
    documentId: document.id,
    title: document.title,
    blockCount: document.blocks.length,
    collaboratorCount: document.collaborators.length,
    activeCollaborators: document.presence.length,
    lockedSections: document.locks.filter((lock) => lock.active).length,
    openComments: document.comments.filter((comment) => comment.status === "open").length,
    openTasks: document.tasks.filter((task) => task.status === "open").length,
    latestVersion,
  };
}

module.exports = {
  addComment,
  addSuggestion,
  applyOperation,
  createResearchDocument,
  createTask,
  exportPublicationOutline,
  lockSection,
  resolveSuggestion,
  setPresence,
  summarizeCollaborationState,
};
