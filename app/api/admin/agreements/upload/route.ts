// file: app/api/admin/agreements/upload/route.ts
// Upload new agreement DOCX to Supabase Storage
// POST /api/admin/agreements/upload

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const version = formData.get('version') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const entityType = formData.get('entityType') as string || 'proprietorship';
    const uploadedByEmail = formData.get('uploadedByEmail') as string;

    // Validation
    if (!file || !version || !title) {
      return NextResponse.json(
        { error: 'File, version, and title are required' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Only .docx files are allowed' },
        { status: 400 }
      );
    }

    // Check if version already exists
    const { data: existingVersion } = await supabase
      .from('agreement_versions')
      .select('id')
      .eq('version', version)
      .single();

    if (existingVersion) {
      return NextResponse.json(
        { error: `Version ${version} already exists. Use a different version number.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, '-');
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
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file: ' + uploadError.message },
        { status: 500 }
      );
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
        version,
        title,
        description,
        file_url: fileUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        entity_type: entityType,
        uploaded_by_email: uploadedByEmail,
        is_active: false
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to delete the uploaded file
      await supabase.storage.from('coach-documents').remove([filePath]);
      return NextResponse.json(
        { error: 'Failed to save agreement record: ' + dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agreement uploaded successfully',
      agreement: agreementRecord
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
