// ============================================================
// FILE: app/api/coach/content/upload/route.ts
// PURPOSE: Coach uploads a worksheet/image mid-session. File is
// stored in content-assets bucket, row created in el_content_items
// (same table as admin CSV bulk upload), auto-tagged from session
// context (skills, child YRL, performance). Returns contentItem.id
// for the SCF to attach to the homework task.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireCoach, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { arcFromPerformance } from '@/lib/homework/content-matcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function safeBasename(input: string): string {
  const base = input.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 50);
  return base || 'worksheet';
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await requireCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const childId = (formData.get('childId') as string | null)?.trim();
  const skillIdsRaw = (formData.get('skillIds') as string | null) || '[]';
  const performanceLevel = formData.get('performanceLevel') as string | null;
  const titleInput = (formData.get('title') as string | null)?.trim();
  const parentInstruction = ((formData.get('parentInstruction') as string | null) || '').trim() || null;
  const coachGuidance = ((formData.get('coachGuidance') as string | null) || '').trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!childId) {
    return NextResponse.json({ error: 'childId is required' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File must be 1 byte to 10MB' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF or image (jpeg/png/webp) accepted' }, { status: 400 });
  }

  let skillIds: string[] = [];
  try {
    const parsed = JSON.parse(skillIdsRaw);
    if (Array.isArray(parsed)) skillIds = parsed.filter((x: unknown) => typeof x === 'string');
  } catch {
    return NextResponse.json({ error: 'skillIds must be a JSON array' }, { status: 400 });
  }

  const title = titleInput || safeBasename(file.name || 'Worksheet');
  const supabase = getServiceSupabase();

  const ext = file.name?.split('.').pop()?.toLowerCase()
    || (file.type === 'application/pdf' ? 'pdf'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp' : 'jpg');
  const storagePath = `worksheets/${childId}/${Date.now()}_${safeBasename(title)}.${ext}`;

  // Child lookup and file buffer are independent — run concurrently
  const [childResult, arrayBuffer] = await Promise.all([
    supabase.from('children').select('id, yrl_level').eq('id', childId).single(),
    file.arrayBuffer(),
  ]);
  const child = childResult.data;

  const { error: uploadError } = await supabase.storage
    .from('content-assets')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error(JSON.stringify({ requestId, event: 'coach_content_upload_storage_error', error: uploadError.message }));
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('content-assets').getPublicUrl(storagePath);
  const assetUrl = urlData.publicUrl;
  const assetFormat = file.type === 'application/pdf' ? 'pdf' : 'image';

  // Auto-derive tags from session context (accepts both SkillRating and Poor/Fair/Good/Excellent)
  const arcStage = arcFromPerformance(performanceLevel);
  const yrlLevel = child?.yrl_level || null;

  // Resolve skill names for better search_text + embedding quality
  let skillNames: string[] = [];
  if (skillIds.length > 0) {
    const { data: skillRows } = await supabase
      .from('el_skills')
      .select('name')
      .in('id', skillIds);
    skillNames = (skillRows || []).map(s => s.name).filter(Boolean);
  }

  const searchTextParts = [
    title,
    'type: worksheet',
    parentInstruction || '',
    coachGuidance || '',
    skillNames.length ? `skills: ${skillNames.join(', ')}` : '',
    yrlLevel ? `level: ${yrlLevel}` : '',
    arcStage ? `stage: ${arcStage}` : '',
  ].filter(Boolean);
  const searchText = searchTextParts.join(' ').trim();

  // Generate embedding (non-blocking on failure — matcher can still find by tags)
  let embeddingJson: string | null = null;
  try {
    const embedding = await generateEmbedding(searchText);
    if (embedding) embeddingJson = JSON.stringify(embedding);
  } catch (err) {
    console.error(JSON.stringify({ requestId, event: 'coach_content_upload_embedding_error', error: (err as Error).message }));
  }

  // INSERT into el_content_items — same table as admin CSV upload
  const { data: contentItem, error: insertError } = await supabase
    .from('el_content_items')
    .insert({
      title,
      content_type: 'worksheet',
      description: parentInstruction || 'Worksheet uploaded by coach during session',
      asset_url: assetUrl,
      asset_format: assetFormat,
      yrl_level: yrlLevel,
      arc_stage: arcStage,
      parent_instruction: parentInstruction,
      coach_guidance: coachGuidance,
      search_text: searchText,
      embedding: embeddingJson,
      is_active: true,
      created_by: auth.email || null,
      metadata: {
        uploaded_by: 'coach',
        source_child_id: childId,
        original_filename: file.name,
        file_size_bytes: file.size,
        storage_path: storagePath,
      },
    })
    .select('id, title, asset_url')
    .single();

  if (insertError || !contentItem) {
    console.error(JSON.stringify({ requestId, event: 'coach_content_upload_insert_error', error: insertError?.message }));
    // Clean up orphan file
    await supabase.storage.from('content-assets').remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: 'Failed to save content item' }, { status: 500 });
  }

  // INSERT el_content_tags — one row per skill, first is primary
  if (skillIds.length > 0) {
    const tagRows = skillIds.map((skillId, i) => ({
      content_item_id: contentItem.id,
      skill_id: skillId,
      is_primary: i === 0,
      relevance_score: 1.0,
    }));
    const { error: tagError } = await supabase.from('el_content_tags').insert(tagRows);
    if (tagError) {
      console.warn(JSON.stringify({ requestId, event: 'coach_content_upload_tag_warning', error: tagError.message }));
    }
  }

  console.log(JSON.stringify({
    requestId,
    event: 'coach_content_uploaded',
    contentItemId: contentItem.id,
    childId,
    skills: skillIds.length,
    yrl: yrlLevel,
    arc: arcStage,
  }));

  return NextResponse.json({
    success: true,
    contentItem: {
      id: contentItem.id,
      title: contentItem.title,
      assetUrl: contentItem.asset_url,
      yrlLevel,
      arcStage,
      skillCount: skillIds.length,
    },
  });
}
