const crypto = require("crypto")

const RESEARCH_OBJECT_TYPES = {
  paper: "paper",
  dataset: "dataset",
  notebook: "notebook",
  protocol: "protocol",
}

const NODE_TYPES = {
  author: "author",
  affiliation: "affiliation",
  concept: "concept",
  dataset: "dataset",
  doi: "doi",
  project: "project",
  protocol: "protocol",
  researchObject: "research-object",
  tool: "tool",
}

const RELATION_TYPES = {
  affiliatedWith: "affiliated-with",
  authored: "authored",
  cites: "cites",
  coOccursWith: "co-occurs-with",
  mentions: "mentions",
  reuses: "reuses",
  uses: "uses",
}

const DEFAULT_ONTOLOGY_TERMS = [
  "CRISPR",
  "gene editing",
  "single-cell RNA sequencing",
  "neural network",
  "climate model",
  "graph neural network",
  "protein folding",
  "retrieval augmented generation",
  "knowledge graph",
  "reproducibility",
  "metagenomics",
]

const DEFAULT_TOOL_TERMS = [
  "Python",
  "R",
  "Jupyter",
  "Nextflow",
  "Snakemake",
  "PyTorch",
  "TensorFlow",
  "Scanpy",
  "Seurat",
  "AlphaFold",
]

const DEFAULT_GENE_TERMS = ["TP53", "BRCA1", "EGFR", "APOE", "CFTR", "KRAS"]

function createKnowledgeGraphState() {
  return {
    nodes: {},
    edges: {},
    objects: {},
    projects: {},
    userProfiles: {},
    timeline: [],
    counters: {
      edge: 1,
      timeline: 1,
    },
  }
}

function registerProject(state, input) {
  const project = {
    id: requiredString(input.id, "id"),
    title: requiredString(input.title, "title"),
    domain: requiredString(input.domain, "domain"),
    ownerId: requiredString(input.ownerId, "ownerId"),
    interests: input.interests || [],
    createdAt: timestamp(),
  }
  state.projects[project.id] = project
  upsertNode(state, {
    id: nodeId(NODE_TYPES.project, project.id),
    type: NODE_TYPES.project,
    label: project.title,
    canonicalName: project.title,
    domains: [project.domain],
    metadata: {
      ownerId: project.ownerId,
      projectId: project.id,
    },
  })
  appendTimeline(state, "project.registered", project.ownerId, {
    projectId: project.id,
    title: project.title,
  })
  return project
}

function ingestResearchObject(state, input) {
  const object = normalizeResearchObject(input)
  state.objects[object.id] = object

  const objectNode = upsertNode(state, {
    id: nodeId(NODE_TYPES.researchObject, object.id),
    type: NODE_TYPES.researchObject,
    label: object.title,
    canonicalName: object.title,
    domains: [object.domain],
    metadata: {
      objectId: object.id,
      objectType: object.type,
      sourceUrl: object.sourceUrl || null,
      uploadedAt: object.uploadedAt,
    },
  })

  if (object.projectId) {
    requireProject(state, object.projectId)
    upsertEdge(state, nodeId(NODE_TYPES.project, object.projectId), objectNode.id, RELATION_TYPES.mentions, {
      evidence: `Project contains ${object.title}`,
      sourceObjectId: object.id,
      confidence: 1,
    })
  }

  const extracted = extractScientificEntities(object.content, {
    ontologyTerms: object.ontologyTerms,
    toolTerms: object.toolTerms,
    geneTerms: object.geneTerms,
  })

  const entityNodes = []
  object.authors.forEach((author) => {
    const authorNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.author, author.name),
      type: NODE_TYPES.author,
      label: author.name,
      canonicalName: author.name,
      domains: [object.domain],
      metadata: {
        orcid: author.orcid || null,
      },
    })
    entityNodes.push(authorNode)
    upsertEdge(state, authorNode.id, objectNode.id, RELATION_TYPES.authored, {
      evidence: `${author.name} authored ${object.title}`,
      sourceObjectId: object.id,
      confidence: 1,
    })
    if (author.affiliation) {
      const affiliationNode = upsertNode(state, {
        id: nodeId(NODE_TYPES.affiliation, author.affiliation),
        type: NODE_TYPES.affiliation,
        label: author.affiliation,
        canonicalName: author.affiliation,
        domains: [object.domain],
      })
      entityNodes.push(affiliationNode)
      upsertEdge(state, authorNode.id, affiliationNode.id, RELATION_TYPES.affiliatedWith, {
        evidence: `${author.name} affiliation in ${object.title}`,
        sourceObjectId: object.id,
        confidence: 0.95,
      })
    }
  })

  object.references.forEach((reference) => {
    const doiValue = cleanDoi(reference.doi || reference)
    const doiNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.doi, doiValue),
      type: NODE_TYPES.doi,
      label: doiValue,
      canonicalName: doiValue,
      domains: [object.domain],
      metadata: {
        url: `https://doi.org/${doiValue}`,
        title: reference.title || null,
      },
    })
    entityNodes.push(doiNode)
    upsertEdge(state, objectNode.id, doiNode.id, RELATION_TYPES.cites, {
      evidence: `${object.title} cites ${doiValue}`,
      sourceObjectId: object.id,
      confidence: 1,
    })
  })

  extracted.dois.forEach((doiValue) => {
    const doiNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.doi, doiValue),
      type: NODE_TYPES.doi,
      label: doiValue,
      canonicalName: doiValue,
      domains: [object.domain],
      metadata: { url: `https://doi.org/${doiValue}` },
    })
    entityNodes.push(doiNode)
    upsertEdge(state, objectNode.id, doiNode.id, RELATION_TYPES.cites, {
      evidence: contextFor(object.content, doiValue),
      sourceObjectId: object.id,
      confidence: 0.9,
    })
  })

  object.datasets.concat(extracted.datasets).forEach((dataset) => {
    const datasetNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.dataset, dataset),
      type: NODE_TYPES.dataset,
      label: dataset,
      canonicalName: dataset,
      domains: [object.domain],
    })
    entityNodes.push(datasetNode)
    upsertEdge(state, objectNode.id, datasetNode.id, RELATION_TYPES.reuses, {
      evidence: contextFor(object.content, dataset),
      sourceObjectId: object.id,
      confidence: 0.9,
    })
  })

  object.protocols.concat(extracted.protocols).forEach((protocol) => {
    const protocolNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.protocol, protocol),
      type: NODE_TYPES.protocol,
      label: protocol,
      canonicalName: protocol,
      domains: [object.domain],
    })
    entityNodes.push(protocolNode)
    upsertEdge(state, objectNode.id, protocolNode.id, RELATION_TYPES.reuses, {
      evidence: contextFor(object.content, protocol),
      sourceObjectId: object.id,
      confidence: 0.9,
    })
  })

  extracted.concepts.concat(extracted.genes).forEach((concept) => {
    const conceptNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.concept, concept),
      type: NODE_TYPES.concept,
      label: concept,
      canonicalName: concept,
      domains: [object.domain],
      metadata: {
        ontology: inferOntology(concept),
      },
    })
    entityNodes.push(conceptNode)
    upsertEdge(state, objectNode.id, conceptNode.id, RELATION_TYPES.mentions, {
      evidence: contextFor(object.content, concept),
      sourceObjectId: object.id,
      confidence: 0.85,
    })
  })

  extracted.tools.forEach((tool) => {
    const toolNode = upsertNode(state, {
      id: nodeId(NODE_TYPES.tool, tool),
      type: NODE_TYPES.tool,
      label: tool,
      canonicalName: tool,
      domains: [object.domain],
    })
    entityNodes.push(toolNode)
    upsertEdge(state, objectNode.id, toolNode.id, RELATION_TYPES.uses, {
      evidence: contextFor(object.content, tool),
      sourceObjectId: object.id,
      confidence: 0.9,
    })
  })

  connectCoOccurringEntities(state, object.id, entityNodes.filter((node) => node.type === NODE_TYPES.concept))

  appendTimeline(state, "research-object.ingested", object.createdBy, {
    objectId: object.id,
    title: object.title,
    extractedEntityCount: unique(entityNodes.map((node) => node.id)).length,
  })

  return {
    object,
    objectNode,
    extracted,
    entityCount: unique(entityNodes.map((node) => node.id)).length,
  }
}

function queryGraph(state, input = {}) {
  const text = normalize(input.text || "")
  const nodeTypes = input.nodeTypes || []
  const domains = input.domains || []
  const minEvidenceCount = input.minEvidenceCount || 0

  const nodes = Object.values(state.nodes)
    .filter((node) => nodeTypes.length === 0 || nodeTypes.includes(node.type))
    .filter((node) => domains.length === 0 || node.domains.some((domain) => domains.includes(domain)))
    .filter((node) => !text || normalize([node.label, node.canonicalName, node.aliases.join(" ")].join(" ")).includes(text))
    .filter((node) => node.evidence.length >= minEvidenceCount)
    .sort((a, b) => b.evidence.length - a.evidence.length || a.label.localeCompare(b.label))

  const nodeSet = new Set(nodes.map((node) => node.id))
  const relationshipTypes = input.relationshipTypes || []
  const edges = Object.values(state.edges)
    .filter((edge) => nodeSet.has(edge.from) || nodeSet.has(edge.to))
    .filter((edge) => relationshipTypes.length === 0 || relationshipTypes.includes(edge.type))
    .sort((a, b) => b.weight - a.weight || a.type.localeCompare(b.type))

  return {
    nodes,
    edges,
    filters: {
      nodeTypes,
      domains,
      relationshipTypes,
      minEvidenceCount,
      text,
    },
  }
}

function findInfluencePath(state, input) {
  const startId = requiredString(input.startId, "startId")
  const endId = requiredString(input.endId, "endId")
  const maxDepth = input.maxDepth || 4
  if (!state.nodes[startId] || !state.nodes[endId]) {
    throw new Error("Both startId and endId must exist")
  }

  const queue = [{ nodeId: startId, path: [startId], edges: [] }]
  const visited = new Set([startId])

  while (queue.length > 0) {
    const current = queue.shift()
    if (current.nodeId === endId) {
      return current
    }
    if (current.path.length > maxDepth) {
      continue
    }
    connectedEdges(state, current.nodeId).forEach((edge) => {
      const next = edge.from === current.nodeId ? edge.to : edge.from
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({
          nodeId: next,
          path: current.path.concat(next),
          edges: current.edges.concat(edge.id),
        })
      }
    })
  }
  return null
}

function getEntityPage(state, entityId) {
  const node = requireNode(state, entityId)
  const inbound = Object.values(state.edges).filter((edge) => edge.to === entityId)
  const outbound = Object.values(state.edges).filter((edge) => edge.from === entityId)
  const relatedEdges = inbound.concat(outbound).sort((a, b) => b.weight - a.weight)
  const related = relatedEdges.map((edge) => {
    const relatedId = edge.from === entityId ? edge.to : edge.from
    return {
      relationship: edge.type,
      weight: edge.weight,
      node: state.nodes[relatedId],
      evidence: edge.evidence.slice(0, 3),
    }
  })

  return {
    node,
    summary: {
      label: node.label,
      type: node.type,
      domains: node.domains,
      evidenceCount: node.evidence.length,
      relationshipCount: relatedEdges.length,
    },
    citations: node.evidence.map((evidence) => ({
      objectId: evidence.sourceObjectId,
      context: evidence.context,
      confidence: evidence.confidence,
    })),
    related,
    schemaOrg: exportJsonLd(state, entityId),
  }
}

function recommendResearchLinks(state, input) {
  const interests = (input.interests || []).map(normalize)
  const projectEntityIds = input.projectEntityIds || []
  const excluded = new Set(projectEntityIds)
  const limit = input.limit || 5
  const projectNeighbors = new Set()

  projectEntityIds.forEach((entityId) => {
    connectedEdges(state, entityId).forEach((edge) => {
      projectNeighbors.add(edge.from === entityId ? edge.to : edge.from)
    })
  })

  return Object.values(state.nodes)
    .filter((node) => !excluded.has(node.id))
    .filter((node) => node.type !== NODE_TYPES.researchObject)
    .map((node) => {
      const label = normalize(`${node.label} ${node.aliases.join(" ")} ${node.domains.join(" ")}`)
      const interestScore = interests.filter((interest) => label.includes(interest)).length * 3
      const neighborScore = projectNeighbors.has(node.id) ? 4 : 0
      const evidenceScore = Math.min(node.evidence.length, 5)
      const centralityScore = connectedEdges(state, node.id).length
      const score = interestScore + neighborScore + evidenceScore + centralityScore
      return {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        score,
        reasons: buildRecommendationReasons(node, {
          interestScore,
          neighborScore,
          evidenceScore,
          centralityScore,
        }),
        evidence: node.evidence.slice(0, 3),
      }
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function createUserProfile(state, input) {
  const profile = {
    userId: requiredString(input.userId, "userId"),
    interests: input.interests || [],
    followedEntityIds: input.followedEntityIds || [],
    projectIds: input.projectIds || [],
    digestCadence: input.digestCadence || "weekly",
    createdAt: timestamp(),
  }
  state.userProfiles[profile.userId] = profile
  appendTimeline(state, "user-profile.created", profile.userId, {
    interests: profile.interests,
  })
  return profile
}

function buildRecommendationDigest(state, userId) {
  const profile = state.userProfiles[userId]
  if (!profile) {
    throw new Error(`Unknown user profile: ${userId}`)
  }
  const projectEntityIds = profile.projectIds.map((id) => nodeId(NODE_TYPES.project, id))
  const recommendations = recommendResearchLinks(state, {
    interests: profile.interests,
    projectEntityIds: projectEntityIds.concat(profile.followedEntityIds),
    limit: 6,
  })
  return {
    userId,
    cadence: profile.digestCadence,
    generatedAt: timestamp(),
    recommendations,
  }
}

function buildNavigationPayload(state, input = {}) {
  const result = queryGraph(state, input)
  return {
    nodes: result.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      domains: node.domains,
      evidenceCount: node.evidence.length,
    })),
    edges: result.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      weight: edge.weight,
      evidenceCount: edge.evidence.length,
    })),
    availableFilters: {
      nodeTypes: unique(Object.values(state.nodes).map((node) => node.type)).sort(),
      domains: unique(Object.values(state.nodes).flatMap((node) => node.domains)).sort(),
      relationshipTypes: unique(Object.values(state.edges).map((edge) => edge.type)).sort(),
    },
  }
}

function exportJsonLd(state, entityId) {
  const node = requireNode(state, entityId)
  const base = {
    "@context": "https://schema.org",
    "@id": `scibase:${node.id}`,
    name: node.label,
    alternateName: node.aliases,
    about: node.domains,
  }

  if (node.type === NODE_TYPES.author) {
    return {
      ...base,
      "@type": "Person",
      identifier: node.metadata.orcid || undefined,
    }
  }
  if (node.type === NODE_TYPES.dataset) {
    return {
      ...base,
      "@type": "Dataset",
    }
  }
  if (node.type === NODE_TYPES.tool) {
    return {
      ...base,
      "@type": "SoftwareApplication",
      applicationCategory: "ResearchSoftware",
    }
  }
  if (node.type === NODE_TYPES.doi) {
    return {
      ...base,
      "@type": "ScholarlyArticle",
      identifier: node.canonicalName,
      sameAs: node.metadata.url,
    }
  }
  if (node.type === NODE_TYPES.researchObject) {
    return {
      ...base,
      "@type": "CreativeWork",
      encodingFormat: node.metadata.objectType,
      url: node.metadata.sourceUrl || undefined,
    }
  }
  if (node.type === NODE_TYPES.project) {
    return {
      ...base,
      "@type": "ResearchProject",
      identifier: node.metadata.projectId,
    }
  }
  return {
    ...base,
    "@type": "DefinedTerm",
  }
}

function extractScientificEntities(content, input = {}) {
  const text = requiredString(content, "content")
  const ontologyTerms = input.ontologyTerms || DEFAULT_ONTOLOGY_TERMS
  const toolTerms = input.toolTerms || DEFAULT_TOOL_TERMS
  const geneTerms = input.geneTerms || DEFAULT_GENE_TERMS

  return {
    concepts: findTerms(text, ontologyTerms),
    tools: findTerms(text, toolTerms),
    genes: findTerms(text, geneTerms),
    dois: extractDois(text),
    datasets: extractTaggedValues(text, "dataset"),
    protocols: extractTaggedValues(text, "protocol"),
  }
}

function normalizeResearchObject(input) {
  const type = requiredEnum(input.type, RESEARCH_OBJECT_TYPES, "type")
  return {
    id: requiredString(input.id, "id"),
    type,
    title: requiredString(input.title, "title"),
    domain: requiredString(input.domain, "domain"),
    content: requiredString(input.content, "content"),
    projectId: input.projectId || null,
    createdBy: input.createdBy || "system",
    sourceUrl: input.sourceUrl || null,
    authors: (input.authors || []).map((author) => ({
      name: requiredString(author.name, "author.name"),
      affiliation: author.affiliation || null,
      orcid: author.orcid || null,
    })),
    references: input.references || [],
    datasets: input.datasets || [],
    protocols: input.protocols || [],
    ontologyTerms: input.ontologyTerms,
    toolTerms: input.toolTerms,
    geneTerms: input.geneTerms,
    uploadedAt: input.uploadedAt || timestamp(),
  }
}

function connectCoOccurringEntities(state, sourceObjectId, conceptNodes) {
  const uniqueConcepts = uniqueBy(conceptNodes, (node) => node.id)
  for (let i = 0; i < uniqueConcepts.length; i += 1) {
    for (let j = i + 1; j < uniqueConcepts.length; j += 1) {
      upsertEdge(state, uniqueConcepts[i].id, uniqueConcepts[j].id, RELATION_TYPES.coOccursWith, {
        evidence: `${uniqueConcepts[i].label} and ${uniqueConcepts[j].label} appear in the same research object`,
        sourceObjectId,
        confidence: 0.75,
      })
    }
  }
}

function upsertNode(state, input) {
  const existing = state.nodes[input.id]
  const evidence = {
    sourceObjectId: input.metadata?.objectId || null,
    context: input.metadata?.sourceUrl || input.label,
    confidence: 1,
    createdAt: timestamp(),
  }

  if (existing) {
    existing.aliases = unique(existing.aliases.concat(input.aliases || []))
    existing.domains = unique(existing.domains.concat(input.domains || []))
    existing.metadata = { ...existing.metadata, ...(input.metadata || {}) }
    existing.evidence.push(evidence)
    existing.updatedAt = timestamp()
    return existing
  }

  const node = {
    id: input.id,
    type: requiredEnum(input.type, NODE_TYPES, "node.type"),
    label: requiredString(input.label, "label"),
    canonicalName: requiredString(input.canonicalName, "canonicalName"),
    aliases: input.aliases || [],
    domains: input.domains || [],
    metadata: input.metadata || {},
    evidence: [evidence],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.nodes[node.id] = node
  return node
}

function upsertEdge(state, from, to, type, input) {
  requireNode(state, from)
  requireNode(state, to)
  const stableKey = [from, to, type].join("|")
  const existing = Object.values(state.edges).find((edge) => edge.stableKey === stableKey)
  const evidence = {
    sourceObjectId: input.sourceObjectId || null,
    context: input.evidence || "",
    confidence: typeof input.confidence === "number" ? input.confidence : 1,
    createdAt: timestamp(),
  }

  if (existing) {
    existing.weight += 1
    existing.evidence.push(evidence)
    existing.updatedAt = timestamp()
    return existing
  }

  const edge = {
    id: `edge-${state.counters.edge++}`,
    stableKey,
    from,
    to,
    type: requiredEnum(type, RELATION_TYPES, "relationship.type"),
    weight: 1,
    evidence: [evidence],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }
  state.edges[edge.id] = edge
  return edge
}

function connectedEdges(state, nodeIdValue) {
  return Object.values(state.edges).filter((edge) => edge.from === nodeIdValue || edge.to === nodeIdValue)
}

function buildRecommendationReasons(node, scores) {
  const reasons = []
  if (scores.interestScore > 0) {
    reasons.push("matches declared research interests")
  }
  if (scores.neighborScore > 0) {
    reasons.push("connected to current project graph")
  }
  if (scores.evidenceScore > 0) {
    reasons.push(`${node.evidence.length} evidence item(s) in the knowledge graph`)
  }
  if (scores.centralityScore > 2) {
    reasons.push("highly connected across research objects")
  }
  return reasons
}

function findTerms(text, terms) {
  const found = []
  terms.forEach((term) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i")
    if (pattern.test(text)) {
      found.push(term)
    }
  })
  return unique(found)
}

function extractDois(text) {
  const matches = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) || []
  return unique(matches.map(cleanDoi).filter(Boolean))
}

function cleanDoi(value) {
  return requiredString(value, "doi").replace(/[.,;:)\]]+$/g, "")
}

function extractTaggedValues(text, tag) {
  const pattern = new RegExp(`${tag}\\s*:\\s*([^.;\\n]+)`, "gi")
  const values = []
  let match = pattern.exec(text)
  while (match) {
    values.push(cleanTaggedValue(match[1]))
    match = pattern.exec(text)
  }
  return unique(values)
}

function cleanTaggedValue(value) {
  return value
    .trim()
    .replace(/\s+and\s+(validates|uses|stores|cites|contains|links|supports)\b.*$/i, "")
    .replace(/[.;]+$/g, "")
}

function contextFor(content, term) {
  const normalized = normalize(content)
  const index = normalized.indexOf(normalize(term))
  if (index === -1) {
    return term
  }
  const start = Math.max(0, index - 80)
  const end = Math.min(content.length, index + term.length + 120)
  return content.slice(start, end).replace(/\s+/g, " ").trim()
}

function inferOntology(concept) {
  if (DEFAULT_GENE_TERMS.includes(concept)) {
    return "gene-symbol"
  }
  if (/^[A-Z0-9-]+$/.test(concept) && concept.length <= 8) {
    return "scientific-abbreviation"
  }
  return "scientific-concept"
}

function appendTimeline(state, action, actorId, details = {}) {
  const entry = {
    id: `timeline-${state.counters.timeline++}`,
    action,
    actorId,
    details,
    createdAt: timestamp(),
  }
  state.timeline.push(entry)
  return entry
}

function requireProject(state, projectId) {
  const project = state.projects[projectId]
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`)
  }
  return project
}

function requireNode(state, entityId) {
  const node = state.nodes[entityId]
  if (!node) {
    throw new Error(`Unknown node: ${entityId}`)
  }
  return node
}

function nodeId(type, value) {
  return `${type}:${slug(value)}`
}

function slug(value) {
  return normalize(requiredString(String(value), "value"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function requiredEnum(value, allowed, fieldName) {
  const values = Object.values(allowed)
  if (!values.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${values.join(", ")}`)
  }
  return value
}

function requiredString(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

function normalize(value) {
  return String(value).toLowerCase()
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== "")))
}

function uniqueBy(values, getKey) {
  const seen = new Set()
  const results = []
  values.forEach((value) => {
    const key = getKey(value)
    if (!seen.has(key)) {
      seen.add(key)
      results.push(value)
    }
  })
  return results
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function timestamp() {
  return new Date().toISOString()
}

module.exports = {
  NODE_TYPES,
  RELATION_TYPES,
  RESEARCH_OBJECT_TYPES,
  buildNavigationPayload,
  buildRecommendationDigest,
  createKnowledgeGraphState,
  createUserProfile,
  exportJsonLd,
  extractScientificEntities,
  findInfluencePath,
  getEntityPage,
  ingestResearchObject,
  nodeId,
  queryGraph,
  registerProject,
  stableHash,
}
