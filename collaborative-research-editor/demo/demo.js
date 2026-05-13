const {
  addComment,
  addSuggestion,
  applyOperation,
  createResearchDocument,
  createTask,
  exportPublicationOutline,
  lockSection,
  setPresence,
  summarizeCollaborationState,
} = require("../src/collaborativeResearchEditor");

let document = createResearchDocument({
  id: "immune-response-editorial",
  title: "Immune Response Editorial Draft",
  collaborators: [
    { id: "lead", name: "Lead Author", role: "lead-author" },
    { id: "rev", name: "Peer Reviewer", role: "reviewer" },
  ],
  blocks: [
    {
      id: "abstract",
      type: "markdown",
      section: "Abstract",
      content: "We summarize immune response markers.",
    },
    {
      id: "analysis",
      type: "code",
      section: "Analysis",
      language: "python",
      content: "fit_marker_model()",
    },
    {
      id: "methods",
      type: "latex",
      section: "Methods",
      content: "\\\\alpha + \\\\beta = \\\\gamma",
    },
  ],
});

document = applyOperation(document, {
  actorId: "lead",
  type: "insert-block",
  afterBlockId: "analysis",
  block: {
    id: "notebook-validation",
    type: "notebook",
    section: "Analysis",
    kernel: "python3",
    content: "validate_markers()",
  },
  reason: "Add executable validation notebook",
});

document = lockSection(document, {
  actorId: "lead",
  section: "Analysis",
  reason: "Freeze analysis while reviewer checks outputs",
});

document = addComment(document, {
  actorId: "rev",
  blockId: "abstract",
  text: "Please include the validation cohort size.",
});

document = addSuggestion(document, {
  actorId: "rev",
  blockId: "abstract",
  replacement: "We summarize immune response markers across two validation cohorts.",
  rationale: "Cohort context makes the abstract easier to audit.",
});

document = createTask(document, {
  actorId: "lead",
  blockId: "abstract",
  title: "Add validation cohort size",
  dueDate: "2026-06-01",
});

document = setPresence(document, {
  actorId: "rev",
  blockId: "abstract",
  cursor: { line: 1, column: 42 },
});

console.log(
  JSON.stringify(
    {
      summary: summarizeCollaborationState(document),
      outline: exportPublicationOutline(document),
    },
    null,
    2,
  ),
);
