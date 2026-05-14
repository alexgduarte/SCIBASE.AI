const {
  NODE_TYPES,
  RESEARCH_OBJECT_TYPES,
  buildNavigationPayload,
  buildRecommendationDigest,
  createKnowledgeGraphState,
  createUserProfile,
  getEntityPage,
  ingestResearchObject,
  nodeId,
  queryGraph,
  registerProject,
} = require("../src/scientificKnowledgeGraph")

const state = createKnowledgeGraphState()

registerProject(state, {
  id: "project-neuro-crispr",
  title: "Neurogenomics CRISPR Atlas",
  domain: "neuroscience",
  ownerId: "user-42",
  interests: ["CRISPR", "single-cell RNA sequencing", "TP53"],
})

ingestResearchObject(state, {
  id: "paper-neuro-1",
  type: RESEARCH_OBJECT_TYPES.paper,
  title: "CRISPR perturbation maps neural disease pathways",
  domain: "neuroscience",
  projectId: "project-neuro-crispr",
  createdBy: "user-42",
  sourceUrl: "https://example.org/neuro-crispr",
  authors: [
    { name: "Mina Chen", affiliation: "Atlas Institute", orcid: "0000-0002-1825" },
    { name: "Omar Silva", affiliation: "Atlas Institute" },
  ],
  references: [{ doi: "10.1101/2026.01.15.123456", title: "Perturb-seq reference" }],
  datasets: ["NeuroCRISPR Cell Atlas"],
  protocols: ["pooled CRISPR knockout screen"],
  content:
    "CRISPR perturbation and single-cell RNA sequencing identify TP53-linked stress circuits. " +
    "Dataset: NeuroCRISPR Cell Atlas. Protocol: pooled CRISPR knockout screen. " +
    "The analysis uses Python, Scanpy, and Jupyter notebooks, and cites 10.1101/2026.01.15.123456.",
})

ingestResearchObject(state, {
  id: "notebook-neuro-1",
  type: RESEARCH_OBJECT_TYPES.notebook,
  title: "Scanpy reproducibility notebook for NeuroCRISPR",
  domain: "neuroscience",
  projectId: "project-neuro-crispr",
  createdBy: "user-42",
  authors: [{ name: "Mina Chen", affiliation: "Atlas Institute" }],
  content:
    "This Jupyter notebook reuses Dataset: NeuroCRISPR Cell Atlas and validates CRISPR effects with Scanpy. " +
    "It stores evidence for reproducibility and knowledge graph curation.",
})

createUserProfile(state, {
  userId: "user-42",
  interests: ["CRISPR", "neuroscience", "reproducibility"],
  projectIds: ["project-neuro-crispr"],
  followedEntityIds: [nodeId(NODE_TYPES.concept, "CRISPR")],
})

const crisprPage = getEntityPage(state, nodeId(NODE_TYPES.concept, "CRISPR"))
const graphSearch = queryGraph(state, {
  text: "crispr",
  domains: ["neuroscience"],
})
const navigation = buildNavigationPayload(state, {
  domains: ["neuroscience"],
})
const digest = buildRecommendationDigest(state, "user-42")

console.log("Scientific Knowledge Graph demo")
console.log(`Entity page: ${crisprPage.summary.label}`)
console.log(`Evidence items: ${crisprPage.summary.evidenceCount}`)
console.log(`Search results: ${graphSearch.nodes.map((node) => node.label).join(", ")}`)
console.log(`Navigation nodes: ${navigation.nodes.length}, edges: ${navigation.edges.length}`)
console.log("Top recommendations:")
digest.recommendations.slice(0, 3).forEach((recommendation, index) => {
  console.log(`${index + 1}. ${recommendation.label} (${recommendation.type})`)
  console.log(`   reasons: ${recommendation.reasons.join("; ")}`)
})
