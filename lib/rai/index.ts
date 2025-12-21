// file: lib/rai/index.ts
// rAI v2.0 - Main exports

// Types
export * from './types';

// Embeddings
export { generateEmbedding, buildSearchableContent, buildSessionSearchableContent } from './embeddings';

// Intent Classification
export { tier0Router, tier1Classifier, classifyIntent, isRecentSessionQuery } from './intent-classifier';

// Query Filters
export { extractQueryFilters, extractChildName } from './query-filters';

// Hybrid Search
export { 
  hybridSearch, 
  getSessionCache, 
  formatCachedSummary, 
  formatEventsForContext 
} from './hybrid-search';

// Prompts
export { 
  buildParentPrompt, 
  buildCoachPrompt, 
  buildSessionPrepPrompt,
  buildAdminPrompt,
  getSystemPrompt,
  OPERATIONAL_RESPONSES,
  OFF_LIMITS_RESPONSES,
} from './prompts';
