// =============================================================================
// FILE: app/api/parent/reading/log/route.ts
// PURPOSE: POST a reading log entry — creates a learning_event with embedding
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

async function generateAISummary(prompt: string): Promise<string> {
  try {
    const model = getGenAI().getGenerativeModel({ model: getGeminiModel('story_summarization') });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[READING_LOG] AI summary error:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth — parent Bearer token pattern
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { childId, bookTitle, bookAuthor, bookId, pagesRead, minutesRead, rating, notes } = body;

    if (!childId || !bookTitle) {
      return NextResponse.json({ error: 'childId and bookTitle are required' }, { status: 400 });
    }

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, parent_email, age')
      .eq('id', childId)
      .eq('parent_email', user.email ?? '')
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Build the reading log data
    const logData = {
      book_title: bookTitle,
      book_author: bookAuthor || null,
      book_id: bookId || null,
      pages_read: pagesRead || null,
      minutes_read: minutesRead || null,
      rating: rating || null,
      notes: notes || null,
      logged_by: 'parent',
    };

    // Generate AI summary
    const summaryPrompt = `Summarize this reading log in 1 encouraging sentence for a parent:
${child.child_name} (age ${child.age || 'unknown'}) read "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}.
${pagesRead ? `Pages read: ${pagesRead}.` : ''}
${minutesRead ? `Time spent: ${minutesRead} minutes.` : ''}
${rating ? `Rating: ${rating}/5 stars.` : ''}
${notes ? `Parent notes: ${notes}` : ''}`;

    const aiSummary = await generateAISummary(summaryPrompt);

    // Generate embedding for RAG
    const searchableText = `reading log book ${bookTitle} ${bookAuthor || ''} ${notes || ''} ${aiSummary}`;
    const embedding = await generateEmbedding(searchableText);

    // Insert learning_event
    const { data: event, error: insertError } = await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'reading_log',
        event_date: new Date().toISOString(),
        data: logData,
        ai_summary: aiSummary,
        embedding: JSON.stringify(embedding) as unknown as string,
        created_by: user.id,
      })
      .select('id, event_date, ai_summary')
      .single();

    if (insertError) {
      console.error('[READING_LOG] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save reading log' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('[READING_LOG] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
