# rAI Proper Implementation - Tech Debt

**Priority:** HIGH (USP Feature)
**Estimated Time:** 4-6 hours dedicated session
**Date Added:** January 11, 2026

---

## Current State (Broken)

The current `/api/coach/ai` implementation:
- ❌ Tries to detect child names from message text using regex
- ❌ Ignores `childId`, `studentName` passed from UI
- ❌ No embeddings or vector search
- ❌ No caching strategy
- ❌ Can hallucinate when no data found
- ❌ Separate endpoint from parent rAI

---

## Required Implementation (Per rAI v2.0 Design)

### Single Endpoint: `/api/chat`

```typescript
interface ChatRequest {
  message: string;
  userRole: 'parent' | 'coach' | 'admin';
  userId: string;
  childId?: string;  // Direct context - no guessing!
  chatHistory?: Message[];
}
```

### Core Components

1. **Tier 0 Regex Router** - Instant SQL answers for operational queries
2. **Tier 1 LLM Classifier** - Intent detection for complex queries
3. **Hybrid RAG** - HNSW vector search + keyword filtering
4. **Cache-First** - Check `last_session_summary` before expensive calls
5. **Role-Based Access** - Parents see their children only
6. **Anti-Hallucination** - Never invent data

### Data Pipeline

1. `learning_events` table with embeddings
2. HNSW index (replace IVFFlat if exists)
3. `hybrid_match_learning_events` function
4. Embedding generation on:
   - Assessment completion
   - Session completion
   - Recall.ai transcript processing

---

## Implementation Tasks

### Phase 1: Data Pipeline
- [ ] Add embedding column to `learning_events`
- [ ] Create HNSW index
- [ ] Create `hybrid_match_learning_events` function
- [ ] Modify `/api/assessment/analyze` to save to learning_events
- [ ] Update Recall.ai webhook to generate embeddings

### Phase 2: Chat API
- [ ] Create unified `/api/chat` endpoint
- [ ] Implement Tier 0 Regex Router
- [ ] Implement Tier 1 LLM Classifier
- [ ] Build LEARNING handler with hybrid RAG
- [ ] Build OPERATIONAL handler with SQL
- [ ] Build SCHEDULE handler
- [ ] Build OFF_LIMITS handler
- [ ] Add Coach Chain of Thought prompts
- [ ] Add Parent caching strategy

### Phase 3: UI Integration
- [ ] Update parent dashboard ChatWidget
- [ ] Update coach student detail page
- [ ] Update coach AI assistant page
- [ ] Add conversation memory support

### Phase 4: Testing
- [ ] Parent journey - cache hit
- [ ] Parent journey - RAG
- [ ] Coach journey - CoT
- [ ] Multi-child disambiguation
- [ ] Anti-hallucination verification

---

## Reference Document

Full design: `/mnt/project/yestoryd-rai-design-v2.md`

---

## Quick Workaround (If Needed Before Implementation)

If rAI is needed urgently before proper implementation:

```typescript
// In /api/coach/ai - use passed childId directly
const childId = body.studentId;  // Use passed ID, don't detect from message
if (childId) {
  const { data: child } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .single();
  // Build context from actual data...
}
```

This is a band-aid, not a solution.
