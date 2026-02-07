// ============================================================
// FILE: app/api/admin/agreements/upload/route.ts
// ============================================================
// HARDENED VERSION - Upload Agreement DOCX
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const uploadSchema = z.object({
  version: z.string().min(1).max(20).regex(/^[\d.]+$/, 'Version must be numeric (e.g., 1.0, 2.1)'),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  entityType: z.enum(['proprietorship', 'company', 'partnership', 'llp']).default('proprietorship'),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'agreements_upload_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const version = formData.get('version') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const entityType = formData.get('entityType') as string | null;

    // Validate required fields
    const validation = uploadSchema.safeParse({
      version,
      title,
      description: description || undefined,
      entityType: entityType || 'proprietorship',
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Only .docx files are allowed' }, { status: 400 });
    }

    // File size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    const validatedData = validation.data;

    console.log(JSON.stringify({ requestId, event: 'agreements_upload_request', adminEmail: auth.email, version: validatedData.version, fileName: file.name }));

    const supabase = getServiceSupabase();

    // Check if version already exists
    const { data: existingVersion } = await supabase
      .from('agreement_versions')
      .select('id')
      .eq('version', validatedData.version)
      .maybeSingle();

    if (existingVersion) {
      return NextResponse.json({ error: `Version ${validatedData.version} already exists. Use a different version number.` }, { status: 409 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedVersion = validatedData.version.replace(/[^a-zA-Z0-9.-]/g, '-');
    const fileName = `agreement-v${sanitizedVersion}-${timestamp}.docx`;
    const filePath = `agreements/${fileName}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('coach-documents')
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      });

    if (uploadError) {
      console.error(JSON.stringify({ requestId, event: 'agreements_upload_storage_error', error: uploadError.message }));
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('coach-documents')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Create database record
    const { data: agreementRecord, error: dbError } = await supabase
      .from('agreement_versions')
      .insert({
        version: validatedData.version,
        title: validatedData.title,
        description: validatedData.description || null,
        file_url: fileUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        entity_type: validatedData.entityType,
        uploaded_by_email: auth.email,
        is_active: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error(JSON.stringify({ requestId, event: 'agreements_upload_db_error', error: dbError.message }));
      // Try to delete the uploaded file
      await supabase.storage.from('coach-documents').remove([filePath]);
      return NextResponse.json({ error: 'Failed to save agreement record: ' + dbError.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'agreement_uploaded',
      details: {
        request_id: requestId,
        agreement_id: agreementRecord.id,
        version: validatedData.version,
        title: validatedData.title,
        file_name: file.name,
        file_size: file.size,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'agreements_upload_success', agreementId: agreementRecord.id, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Agreement uploaded successfully',
      agreement: agreementRecord,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'agreements_upload_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
