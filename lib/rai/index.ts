// file: lib/rai/index.ts
// rAI v2.0 - Main exports

export * from './types';

export { generateEmbedding, buildSearchableContent, buildSessionSearchableContent } from './embeddings';

export { tier0Router, tier1Classifier, classifyIntent, isRecentSessionQuery } from './intent-classifier';

export { extractQueryFilters, extractChildName } from './query-filters';

export { 
  hybridSearch, 
  getSessionCache, 
  formatCachedSummary, 
  formatEventsForContext 
} from './hybrid-search';

export { 
  buildParentPrompt, 
  buildCoachPrompt, 
  buildSessionPrepPrompt,
  buildAdminPrompt,
  getSystemPrompt,
  OPERATIONAL_RESPONSES,
  OFF_LIMITS_RESPONSES,
} from './prompts';
