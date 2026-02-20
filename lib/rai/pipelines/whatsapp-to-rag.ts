// file: lib/rai/pipelines/whatsapp-to-rag.ts
// rAI v2.1 - Summarize WhatsApp lead conversations into learning_events
//
// Called when a lead reaches a conversion milestone (books discovery, enrolls).
// Creates ONE learning_event per conversation, with idempotency.

import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/rai/embeddings';

const getSupabase = createAdminClient;

/**
 * Summarize a WhatsApp lead conversation and save as a learning_event.
 * Idempotent: updates existing event if one already exists for this conversation.
 *
 * @param conversationId - wa_lead_conversations.id
 * @param phone - Lead's phone number (for lookup fallback)
 */
export async function summarizeLeadConversation(
  conversationId: string,
  phone?: string
): Promise<void> {
  const supabase = getSupabase();

  // 1. Get conversation info
  const { data: conversation } = await supabase
    .from('wa_lead_conversations')
    .select('id, phone_number, current_state, collected_data, lead_score')
    .eq('id', conversationId)
    .single();

  if (!conversation) return;

  // 2. Get linked lead for child/parent info
  const { data: lead } = await supabase
    .from('wa_leads')
    .select('id, child_name, parent_name, phone_number, child_id, status')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  // 3. Get conversation messages
  const { data: messages } = await supabase
    .from('wa_lead_messages')
    .select('direction, sender_type, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!messages || messages.length === 0) return;

  // 4. Extract key info
  const collectedData = (conversation.collected_data || {}) as Record<string, unknown>;
  const childName = (lead?.child_name || collectedData.child_name || 'child') as string;
  const parentName = (lead?.parent_name || collectedData.contact_name || 'parent') as string;
  const parentMessages = messages.filter(m => m.sender_type === 'user' || m.direction === 'inbound');

  // 5. Build searchable content (summary, not full conversation)
  const searchableContent = [
    `WhatsApp conversation with ${parentName} about ${childName}`,
    lead?.status ? `Lead status: ${lead.status}` : '',
    collectedData.child_age ? `Child age: ${collectedData.child_age}` : '',
    collectedData.reading_concerns ? `Reading concerns: ${collectedData.reading_concerns}` : '',
    collectedData.city ? `City: ${collectedData.city}` : '',
    `${messages.length} messages exchanged`,
    // Key parent messages (first 3 for context)
    ...parentMessages.slice(0, 3).map(m => (m.content || '').substring(0, 100)),
  ].filter(Boolean).join('. ');

  if (searchableContent.length < 30) return;

  // 6. Build conversation preview
  const conversationPreview = messages
    .slice(0, 20)
    .map(m => `${m.direction === 'inbound' ? 'Parent' : 'Bot'}: ${(m.content || '').substring(0, 150)}`)
    .join('\n');

  // 7. Create or update learning_event (idempotent by conversation_id)
  try {
    const embedding = await generateEmbedding(searchableContent);

    const eventData = {
      conversation_id: conversationId,
      lead_id: lead?.id || null,
      parent_name: parentName,
      child_name: childName,
      message_count: messages.length,
      lead_status: lead?.status || conversation.current_state,
      lead_score: conversation.lead_score,
      conversation_preview: conversationPreview.substring(0, 500),
    };

    const aiSummary = `WhatsApp lead: ${parentName} asked about ${childName}. Status: ${lead?.status || 'unknown'}. ${messages.length} messages. ${collectedData.reading_concerns ? `Concerns: ${collectedData.reading_concerns}` : ''}`;

    // Child ID is required for learning_events — skip if lead has no linked child
    const childId = lead?.child_id;
    if (!childId) {
      console.log(`[WhatsApp→RAG] Skipping — no child_id linked for conversation ${conversationId}`);
      return;
    }

    // Check for existing event to avoid duplicates (one per child)
    const { data: existing } = await supabase
      .from('learning_events')
      .select('id')
      .eq('child_id', childId)
      .eq('event_type', 'lead_conversation')
      .maybeSingle();

    if (existing) {
      await supabase.from('learning_events').update({
        event_data: eventData,
        content_for_embedding: searchableContent,
        embedding: JSON.stringify(embedding),
        ai_summary: aiSummary,
        event_date: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('learning_events').insert({
        child_id: childId,
        event_type: 'lead_conversation',
        event_date: new Date().toISOString(),
        event_data: eventData,
        ai_summary: aiSummary,
        content_for_embedding: searchableContent,
        embedding: JSON.stringify(embedding),
      });
    }

    console.log(`[WhatsApp→RAG] Learning event ${existing ? 'updated' : 'created'} for conversation ${conversationId}`);
  } catch (e) {
    console.error('Failed to create WhatsApp learning_event:', e);
  }
}
