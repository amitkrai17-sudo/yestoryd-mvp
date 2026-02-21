// ============================================================
// FILE: app/api/admin/content-upload/route.ts
// PURPOSE: Bulk CSV upload for el_content_items
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Valid enum values
const VALID_CONTENT_TYPES = ['video', 'worksheet', 'game', 'audio', 'interactive', 'parent_guide'];
const VALID_ARC_STAGES = ['assess', 'remediate', 'celebrate'];
const VALID_DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const YRL_LEVEL_REGEX = /^[FBM][1-4]$/;

interface ParsedRow {
  title: string;
  content_type: string;
  description?: string;
  asset_url?: string;
  yrl_level?: string;
  arc_stage?: string;
  difficulty_level?: string;
  skill_tags?: string;
  sub_skill_tags?: string;
  coach_guidance?: string;
  parent_instruction?: string;
  child_label?: string;
  duration_seconds?: string;
  asset_format?: string;
}

interface RowError {
  row: number;
  field: string;
  error: string;
}

function resolveAssetUrl(raw: string): { asset_url: string; metadata: Record<string, any> } {
  const metadata: Record<string, any> = {};

  if (raw.startsWith('youtube:')) {
    const videoId = raw.slice('youtube:'.length).trim();
    metadata.youtube_id = videoId;
    return {
      asset_url: `https://www.youtube.com/watch?v=${videoId}`,
      metadata,
    };
  }

  if (raw.startsWith('storage:')) {
    const path = raw.slice('storage:'.length).trim();
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return {
      asset_url: `${baseUrl}/storage/v1/object/public/${path}`,
      metadata,
    };
  }

  if (raw.startsWith('engine:')) {
    const engine = raw.slice('engine:'.length).trim();
    metadata.game_engine = engine;
    return {
      asset_url: raw,
      metadata,
    };
  }

  return { asset_url: raw, metadata };
}

function composeSearchText(row: ParsedRow, skillNames: string[]): string {
  const parts: string[] = [];
  if (row.title) parts.push(row.title);
  if (row.content_type) parts.push(`type: ${row.content_type}`);
  if (row.description) parts.push(row.description);
  if (skillNames.length > 0) parts.push(`skills: ${skillNames.join(', ')}`);
  if (row.yrl_level) parts.push(`level: ${row.yrl_level}`);
  if (row.arc_stage) parts.push(`stage: ${row.arc_stage}`);
  if (row.difficulty_level) parts.push(`difficulty: ${row.difficulty_level}`);
  if (row.coach_guidance) parts.push(`coach guidance: ${row.coach_guidance}`);
  if (row.parent_instruction) parts.push(`parent instruction: ${row.parent_instruction}`);
  if (row.child_label) parts.push(row.child_label);
  if (row.sub_skill_tags) parts.push(`sub-skills: ${row.sub_skill_tags}`);
  return parts.join(' ').trim();
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const body = await request.json();
    const items: ParsedRow[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    if (items.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per upload' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    console.log(JSON.stringify({ requestId, event: 'content_upload_start', count: items.length, admin: auth.email }));

    // Pre-fetch all skills for tag resolution
    const { data: allSkills } = await (supabase as any)
      .from('el_skills')
      .select('id, name, skill_tag');

    const skillMap = new Map<string, { id: string; name: string }>();
    for (const skill of allSkills || []) {
      skillMap.set(skill.name.toLowerCase(), { id: skill.id, name: skill.name });
      if (skill.skill_tag) {
        skillMap.set(skill.skill_tag.toLowerCase(), { id: skill.id, name: skill.name });
      }
    }

    const createdIds: string[] = [];
    const errors: RowError[] = [];
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNum = i + 1;
      const rowErrors: RowError[] = [];

      // Validate required fields
      if (!row.title?.trim()) {
        rowErrors.push({ row: rowNum, field: 'title', error: 'Title is required' });
      }
      if (!row.content_type?.trim()) {
        rowErrors.push({ row: rowNum, field: 'content_type', error: 'Content type is required' });
      } else if (!VALID_CONTENT_TYPES.includes(row.content_type.trim().toLowerCase())) {
        rowErrors.push({ row: rowNum, field: 'content_type', error: `Invalid content type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` });
      }

      // Validate optional enums
      if (row.yrl_level?.trim() && !YRL_LEVEL_REGEX.test(row.yrl_level.trim())) {
        rowErrors.push({ row: rowNum, field: 'yrl_level', error: 'Must match pattern F1-F4, B1-B4, or M1-M4' });
      }
      if (row.arc_stage?.trim() && !VALID_ARC_STAGES.includes(row.arc_stage.trim().toLowerCase())) {
        rowErrors.push({ row: rowNum, field: 'arc_stage', error: `Must be one of: ${VALID_ARC_STAGES.join(', ')}` });
      }
      if (row.difficulty_level?.trim() && !VALID_DIFFICULTY_LEVELS.includes(row.difficulty_level.trim().toLowerCase())) {
        rowErrors.push({ row: rowNum, field: 'difficulty_level', error: `Must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}` });
      }

      // Resolve skill tags
      const skillTagsRaw = row.skill_tags?.split('|').map(s => s.trim()).filter(Boolean) || [];
      const subSkillTagsRaw = row.sub_skill_tags?.split('|').map(s => s.trim()).filter(Boolean) || [];
      const resolvedSkills: { id: string; name: string; subSkill?: string; isPrimary: boolean }[] = [];

      for (let j = 0; j < skillTagsRaw.length; j++) {
        const tag = skillTagsRaw[j];
        const resolved = skillMap.get(tag.toLowerCase());
        if (!resolved) {
          rowErrors.push({ row: rowNum, field: 'skill_tags', error: `Skill "${tag}" not found in el_skills` });
        } else {
          resolvedSkills.push({
            id: resolved.id,
            name: resolved.name,
            subSkill: subSkillTagsRaw[j] || undefined,
            isPrimary: j === 0,
          });
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // Process this row
      try {
        // Resolve asset URL
        const assetUrlRaw = row.asset_url?.trim() || '';
        const { asset_url, metadata } = assetUrlRaw ? resolveAssetUrl(assetUrlRaw) : { asset_url: null, metadata: {} as Record<string, any> };

        // Duration → stored inside metadata JSONB (not a top-level column)
        const durationSeconds = row.duration_seconds?.trim() ? parseInt(row.duration_seconds.trim(), 10) : null;
        if (durationSeconds !== null) {
          metadata.duration_seconds = durationSeconds;
        }

        // Compose search text
        const skillNames = resolvedSkills.map(s => s.name);
        const searchText = composeSearchText(row, skillNames);

        // Generate embedding
        const embedding = await generateEmbedding(searchText);

        // INSERT el_content_items
        const { data: inserted, error: insertError } = await (supabase as any)
          .from('el_content_items')
          .insert({
            title: row.title.trim(),
            content_type: row.content_type.trim().toLowerCase(),
            description: row.description?.trim() || null,
            asset_url,
            asset_format: row.asset_format?.trim() || null,
            yrl_level: row.yrl_level?.trim() || null,
            arc_stage: row.arc_stage?.trim().toLowerCase() || null,
            difficulty_level: row.difficulty_level?.trim().toLowerCase() || null,
            coach_guidance: row.coach_guidance?.trim() || null,
            parent_instruction: row.parent_instruction?.trim() || null,
            child_label: row.child_label?.trim() || null,
            metadata,
            search_text: searchText,
            embedding: JSON.stringify(embedding),
            created_by: auth.email,
            is_active: true,
          })
          .select('id')
          .single();

        if (insertError) {
          errors.push({ row: rowNum, field: '_insert', error: insertError.message });
          continue;
        }

        const contentId = inserted.id;
        createdIds.push(contentId);

        // INSERT el_content_tags
        if (resolvedSkills.length > 0) {
          const tagRows = resolvedSkills.map(skill => ({
            content_item_id: contentId,
            skill_id: skill.id,
            sub_skill_tag: skill.subSkill || null,
            is_primary: skill.isPrimary,
          }));

          const { error: tagError } = await (supabase as any)
            .from('el_content_tags')
            .insert(tagRows);

          if (tagError) {
            console.warn(JSON.stringify({ requestId, event: 'tag_insert_warning', row: rowNum, error: tagError.message }));
          }
        }

        successCount++;

        // Rate limit: 100ms delay between rows
        if (i < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (rowError: any) {
        errors.push({ row: rowNum, field: '_processing', error: rowError.message });
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'content_upload_complete',
      success: successCount,
      failed: errors.length,
      total: items.length,
    }));

    return NextResponse.json({
      success: successCount,
      failed: errors.length,
      errors,
      created_ids: createdIds,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'content_upload_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
