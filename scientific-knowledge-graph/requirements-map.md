# Requirements Map

Issue: `SCIBASE-AI/SCIBASE.AI#17` Scientific Knowledge Graph Integration

| Requirement | Implementation evidence |
| --- | --- |
| Parse uploaded content such as papers, datasets, notebooks, and protocols | `ingestResearchObject` accepts typed research objects and normalizes papers, datasets, notebooks, and protocols. |
| Identify concepts, authors, affiliations, tools, references, DOIs, datasets, protocols, and ontology-like terms | `extractScientificEntities`, author ingestion, reference ingestion, tagged dataset/protocol extraction, and DOI extraction. |
| Output linked data and schema.org-compatible metadata | `exportJsonLd` emits schema.org JSON-LD for people, datasets, software, DOI articles, research projects, research objects, and defined terms. |
| Provide entity pages with aggregated data, citations, and usage context | `getEntityPage` returns summaries, citations, related nodes, evidence, and schema.org payloads. |
| Support graph navigation and semantic search | `queryGraph`, `findInfluencePath`, and `buildNavigationPayload` expose graph search, filters, traversal, nodes, and edges. |
| Support node types for authors, concepts, tools, datasets, protocols, and projects | `NODE_TYPES` defines the supported node taxonomy and tests verify concept/tool/DOI/project nodes. |
| Support filters by domain and relationship type | `queryGraph` and `buildNavigationPayload` return domain/type filters and filtered results. |
| Support AI research recommendations | `recommendResearchLinks` and `buildRecommendationDigest` produce scored recommendation payloads with reasons and evidence. |
| Keep implementation reviewable and locally runnable | The module is dependency-free CommonJS with `npm test` and `npm run demo`. |
| Include tests | `test/scientificKnowledgeGraph.test.js` covers extraction, graph search, entity pages, JSON-LD, traversal, recommendations, and navigation payloads. |
