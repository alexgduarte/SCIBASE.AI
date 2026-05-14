const assert = require("assert")

const {
  NODE_TYPES,
  RELATION_TYPES,
  RESEARCH_OBJECT_TYPES,
  buildNavigationPayload,
  buildRecommendationDigest,
  createKnowledgeGraphState,
  createUserProfile,
  exportJsonLd,
  findInfluencePath,
  getEntityPage,
  ingestResearchObject,
  nodeId,
  queryGraph,
  registerProject,
} = require("../src/scientificKnowledgeGraph")

const state = createKnowledgeGraphState()

registerProject(state, {
  id: "project-kg-1",
  title: "CRISPR Oncology Resistance Atlas",
  domain: "oncology",
  ownerId: "researcher-1",
  interests: ["CRISPR", "TP53", "knowledge graph"],
})

const ingestion = ingestResearchObject(state, {
  id: "paper-1",
  type: RESEARCH_OBJECT_TYPES.paper,
  title: "CRISPR screening reveals TP53 resistance circuits",
  domain: "oncology",
  projectId: "project-kg-1",
  createdBy: "researcher-1",
  sourceUrl: "https://example.org/paper-1",
  authors: [
    { name: "Ada Lovelace", affiliation: "Open Bio Lab", orcid: "0000-0001" },
    { name: "Grace Hopper", affiliation: "Navy Systems Lab" },
  ],
  references: [{ doi: "10.1038/s41586-020-2649-2", title: "Reference screen" }],
  datasets: ["DepMap CRISPR 2025"],
  protocols: ["pooled CRISPR knockout screen"],
  content:
    "We used CRISPR and Python notebooks to study TP53 in oncology. " +
    "Dataset: DepMap CRISPR 2025. Protocol: pooled CRISPR knockout screen. " +
    "The workflow cites 10.1038/s41586-020-2649-2. Jupyter notebooks store the analysis.",
})

assert.strictEqual(ingestion.objectNode.type, NODE_TYPES.researchObject)
assert.ok(ingestion.entityCount >= 8)

const conceptId = nodeId(NODE_TYPES.concept, "CRISPR")
const geneId = nodeId(NODE_TYPES.concept, "TP53")
const toolId = nodeId(NODE_TYPES.tool, "Python")
const doiId = nodeId(NODE_TYPES.doi, "10.1038/s41586-020-2649-2")
const projectId = nodeId(NODE_TYPES.project, "project-kg-1")

assert.ok(state.nodes[conceptId])
assert.ok(state.nodes[geneId])
assert.ok(state.nodes[toolId])
assert.ok(state.nodes[doiId])
assert.strictEqual(state.nodes[doiId].metadata.url, "https://doi.org/10.1038/s41586-020-2649-2")

const oncologyConcepts = queryGraph(state, {
  text: "crispr",
  nodeTypes: [NODE_TYPES.concept],
  domains: ["oncology"],
})

assert.strictEqual(oncologyConcepts.nodes[0].id, conceptId)
assert.ok(oncologyConcepts.edges.some((edge) => edge.type === RELATION_TYPES.mentions))

ingestResearchObject(state, {
  id: "dataset-1",
  type: RESEARCH_OBJECT_TYPES.dataset,
  title: "DepMap CRISPR 2025 release",
  domain: "oncology",
  projectId: "project-kg-1",
  createdBy: "data-steward-1",
  authors: [{ name: "Ada Lovelace", affiliation: "Open Bio Lab" }],
  content:
    "Dataset: DepMap CRISPR 2025. This dataset connects CRISPR, TP53, and knowledge graph curation for reproducibility.",
})

assert.ok(state.nodes[conceptId].evidence.length >= 2)

const page = getEntityPage(state, conceptId)
assert.strictEqual(page.summary.label, "CRISPR")
assert.ok(page.related.some((entry) => entry.node.id === geneId))
assert.ok(page.citations.some((citation) => citation.context.includes("CRISPR")))
assert.strictEqual(page.schemaOrg["@type"], "DefinedTerm")

const path = findInfluencePath(state, {
  startId: projectId,
  endId: geneId,
  maxDepth: 4,
})

assert.ok(path)
assert.strictEqual(path.path[0], projectId)
assert.strictEqual(path.path[path.path.length - 1], geneId)

const jsonLd = exportJsonLd(state, doiId)
assert.strictEqual(jsonLd["@context"], "https://schema.org")
assert.strictEqual(jsonLd["@type"], "ScholarlyArticle")
assert.strictEqual(jsonLd.sameAs, "https://doi.org/10.1038/s41586-020-2649-2")

createUserProfile(state, {
  userId: "researcher-1",
  interests: ["CRISPR", "oncology"],
  projectIds: ["project-kg-1"],
  followedEntityIds: [conceptId],
})

const digest = buildRecommendationDigest(state, "researcher-1")
assert.strictEqual(digest.userId, "researcher-1")
assert.ok(digest.recommendations.length > 0)
assert.ok(digest.recommendations.every((recommendation) => recommendation.evidence.length > 0))
assert.ok(digest.recommendations.some((recommendation) => recommendation.reasons.includes("connected to current project graph")))

const navigation = buildNavigationPayload(state, {
  domains: ["oncology"],
})

assert.ok(navigation.nodes.some((node) => node.id === conceptId))
assert.ok(navigation.availableFilters.nodeTypes.includes(NODE_TYPES.concept))
assert.ok(navigation.availableFilters.relationshipTypes.includes(RELATION_TYPES.coOccursWith))

console.log("scientific knowledge graph tests passed")
