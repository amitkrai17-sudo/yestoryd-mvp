// ============================================================
// GET /api/communication/templates-for-context
// ============================================================
// Returns available templates filtered by context type + user role.
// Query params: ?contextType=session
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// TODO: type properly — new columns not yet in generated types
interface TemplateRow {
  template_code: string;
  name: string;
  description: string | null;
  use_whatsapp: boolean | null;
  use_email: boolean | null;
  wa_variables: string[] | null;
  required_variables: string[] | null;
  trigger_contexts: string[] | null;
  coach_can_trigger: boolean | null;
  admin_can_trigger: boolean | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contextType = searchParams.get('contextType');
    const role = auth.role || 'admin';

    if (!contextType) {
      return NextResponse.json(
        { success: false, error: 'contextType query param required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Fetch active templates that include this context in trigger_contexts
    // Cast to any to access new columns not yet in generated types
    const { data: rawTemplates, error } = await (supabase as any)
      .from('communication_templates')
      .select('template_code, name, description, use_whatsapp, use_email, wa_variables, required_variables, trigger_contexts, coach_can_trigger, admin_can_trigger')
      .eq('is_active', true)
      .contains('trigger_contexts', [contextType]);

    if (error) {
      console.error('[TemplatesForContext] Query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    const templates = (rawTemplates || []) as TemplateRow[];

    // Filter by role permission
    const filtered = templates.filter(t => {
      if (role === 'coach') return t.coach_can_trigger !== false;
      if (role === 'admin') return t.admin_can_trigger !== false;
      return false;
    });

    return NextResponse.json({
      success: true,
      templates: filtered.map(t => ({
        templateCode: t.template_code,
        name: t.name,
        description: t.description,
        channels: {
          whatsapp: t.use_whatsapp ?? false,
          email: t.use_email ?? false,
        },
        variablePlaceholders: t.required_variables || t.wa_variables || [],
      })),
    });

  } catch (error) {
    console.error('[TemplatesForContext] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
