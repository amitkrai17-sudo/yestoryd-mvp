// file: app/api/admin/agreements/[id]/route.ts
// Manage specific agreement version (activate, delete)
// PATCH /api/admin/agreements/[id] - Activate
// DELETE /api/admin/agreements/[id] - Delete

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Activate this agreement version
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (action === 'activate') {
      // Use the database function to activate
      const { error: activateError } = await supabase.rpc('activate_agreement_version', {
        version_id: id
      });

      if (activateError) {
        console.error('Activation error:', activateError);
        return NextResponse.json(
          { error: 'Failed to activate agreement: ' + activateError.message },
          { status: 500 }
        );
      }

      // Fetch the updated agreement
      const { data: agreement } = await supabase
        .from('agreement_versions')
        .select('*')
        .eq('id', id)
        .single();

      return NextResponse.json({
        success: true,
        message: `Agreement v${agreement?.version} is now active`,
        agreement
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "activate".' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete agreement version
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the agreement details first
    const { data: agreement, error: fetchError } = await supabase
      .from('agreement_versions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !agreement) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if active
    if (agreement.is_active) {
      return NextResponse.json(
        { error: 'Cannot delete active agreement. Activate another version first.' },
        { status: 400 }
      );
    }

    // Prevent deletion if coaches have signed this version
    if (agreement.total_signatures > 0) {
      return NextResponse.json(
        { error: `Cannot delete. ${agreement.total_signatures} coach(es) have signed this version.` },
        { status: 400 }
      );
    }

    // Extract file path from URL
    const fileUrl = agreement.file_url;
    const filePath = fileUrl.split('/coach-documents/')[1];

    // Delete from storage
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('coach-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('agreement_versions')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete agreement record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Agreement v${agreement.version} deleted successfully`
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
