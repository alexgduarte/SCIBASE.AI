const assert = require("assert");

const {
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
} = require("../src/collaborativeResearchEditor");

function run() {
  const document = createResearchDocument({
    id: "doc-crispr-safety",
    title: "CRISPR Safety Review",
    collaborators: [
      { id: "u1", name: "Dr. Chen", role: "lead-author" },
      { id: "u2", name: "Dr. Singh", role: "reviewer" },
    ],
    blocks: [
      {
        id: "intro",
        type: "markdown",
        section: "Introduction",
        content: "Initial background.",
      },
      {
        id: "model",
        type: "code",
        section: "Analysis",
        language: "python",
        content: "print('baseline')",
      },
      {
        id: "equation",
        type: "latex",
        section: "Methods",
        content: "E = mc^2",
      },
    ],
  });

  assert.equal(document.versions.length, 1, "creation should produce an auditable initial version");
  assert.deepEqual(
    document.blocks.map((block) => block.type),
    ["markdown", "code", "latex"],
    "scientific block types should preserve the authored structure",
  );

  const edited = applyOperation(document, {
    actorId: "u1",
    type: "update-block",
    blockId: "intro",
    content: "Updated background with registered protocol.",
    reason: "Revise introduction after protocol registration",
  });

  const withNotebook = applyOperation(edited, {
    actorId: "u1",
    type: "insert-block",
    afterBlockId: "model",
    block: {
      id: "notebook-qc",
      type: "notebook",
      section: "Analysis",
      kernel: "python3",
      content: "quality_control()",
    },
    reason: "Add executable notebook quality-control cell",
  });

  assert.equal(withNotebook.blocks[0].content, "Updated background with registered protocol.");
  assert.equal(withNotebook.blocks[2].id, "notebook-qc");
  assert.equal(withNotebook.versions.length, 3, "each accepted edit should create a version snapshot");
  assert.match(withNotebook.headVersionId, /^version-3-/);

  const locked = lockSection(withNotebook, {
    section: "Analysis",
    actorId: "u1",
    reason: "Freeze analysis while reviewers inspect results",
  });

  assert.throws(
    () =>
      applyOperation(locked, {
        actorId: "u2",
        type: "update-block",
        blockId: "model",
        content: "print('reviewer edit')",
      }),
    /locked by u1/,
    "reviewers should not be able to mutate a locked section owned by another collaborator",
  );

  const commented = addComment(locked, {
    actorId: "u2",
    blockId: "intro",
    text: "Please cite the registered protocol.",
  });
  const suggested = addSuggestion(commented, {
    actorId: "u2",
    blockId: "intro",
    replacement: "Updated background with registered protocol and DOI.",
    rationale: "Protocol citation makes the introduction reproducible.",
  });
  const tasked = createTask(suggested, {
    actorId: "u1",
    blockId: "intro",
    title: "Add protocol DOI",
    dueDate: "2026-06-01",
  });
  const resolved = resolveSuggestion(tasked, {
    suggestionId: tasked.suggestions[0].id,
    actorId: "u1",
    status: "accepted",
  });
  const present = setPresence(resolved, {
    actorId: "u2",
    blockId: "intro",
    cursor: { line: 2, column: 11 },
  });

  const outline = exportPublicationOutline(present);
  assert.deepEqual(outline.sections, ["Introduction", "Analysis", "Methods"]);
  assert.equal(outline.reviewItems.comments, 1);
  assert.equal(outline.reviewItems.tasks, 1);
  assert.equal(outline.reviewItems.acceptedSuggestions, 1);

  const summary = summarizeCollaborationState(present);
  assert.equal(summary.documentId, "doc-crispr-safety");
  assert.equal(summary.activeCollaborators, 1);
  assert.equal(summary.lockedSections, 1);
  assert.equal(summary.latestVersion.reason, "Set presence for u2 on intro");
}

run();
console.log("collaborative research editor tests passed");
