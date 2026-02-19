// file: app/api/agreement/active/route.ts
// Fetch active agreement and convert DOCX to HTML
// GET /api/agreement/active

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Variable replacement mapping
interface ConfigValues {
  [key: string]: string;
}

function replaceVariables(html: string, config: ConfigValues, coachData?: any): string {
  // Define all possible variables
  const variables: { [key: string]: string } = {
    // Company details
    '{{company_name}}': config.company_name || 'Yestoryd',
    '{{company_address}}': config.company_address || '',
    '{{company_email}}': config.company_email || '',
    '{{company_phone}}': config.company_phone || '',
    '{{company_website}}': config.company_website || 'https://yestoryd.com',
    '{{company_gstin}}': config.company_gstin || '',
    '{{company_udyam}}': config.company_udyam || '',
    '{{company_pan}}': config.company_pan || '',
    '{{proprietor_name}}': config.proprietor_name || '',
    '{{entity_type}}': config.entity_type || 'Sole Proprietorship',
    
    // Revenue split
    '{{lead_cost_percent}}': config.lead_cost_percent || '20',
    '{{coach_cost_percent}}': config.coach_cost_percent || '50',
    '{{platform_fee_percent}}': config.platform_fee_percent || '30',
    
    // TDS
    '{{tds_rate_standard}}': config.tds_rate_standard || '10',
    '{{tds_rate_no_pan}}': config.tds_rate_no_pan || '20',
    '{{tds_threshold}}': config.tds_threshold || '30,000',
    '{{tds_section}}': config.tds_section || '194J',
    
    // Other terms
    '{{payout_day}}': config.payout_day || '7',
    '{{cancellation_notice_hours}}': config.cancellation_notice_hours || '24',
    '{{termination_notice_days}}': config.termination_notice_days || '30',
    '{{non_solicitation_months}}': config.non_solicitation_months || '12',
    '{{liquidated_damages}}': config.liquidated_damages || '50,000',
    '{{liquidated_damages_multiplier}}': config.liquidated_damages_multiplier || '5',
    '{{no_show_wait_minutes}}': config.no_show_wait_minutes || '15',
    '{{amendment_notice_days}}': config.amendment_notice_days || '30',
    
    // Program details
    '{{program_fee}}': config.program_fee || '5,999',
    '{{program_duration}}': config.program_duration || '12 weeks',
    '{{sessions_per_month}}': config.sessions_per_month || '3',
    '{{session_duration}}': config.session_duration || '45-60 minutes',
    
    // Agreement version
    '{{agreement_version}}': config.agreement_version || '2.1',
    
    // Coach-specific (filled during signing)
    '{{coach_name}}': coachData?.name || '_______________________________',
    '{{coach_address}}': coachData?.address || '_______________________________',
    '{{coach_email}}': coachData?.email || '_______________________________',
    '{{coach_phone}}': coachData?.phone || '_______________________________',
    '{{current_date}}': new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    
    // Calculated values
    '{{yestoryd_lead_coach_share}}': config.coach_cost_percent || '50',
    '{{coach_lead_coach_share}}': String(
      parseInt(config.coach_cost_percent || '50') + parseInt(config.lead_cost_percent || '20')
    ),
  };

  let result = html;
  
  // Replace all variables
  for (const [variable, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coachEmail = searchParams.get('coachEmail');

    // Get active agreement
    const { data: agreement, error: agreementError } = await supabase
      .from('agreement_versions')
      .select('*')
      .eq('is_active', true)
      .single();

    if (agreementError || !agreement) {
      return NextResponse.json(
        { error: 'No active agreement found. Please contact admin.' },
        { status: 404 }
      );
    }

    // Fetch agreement config values
    const { data: configData, error: configError } = await supabase
      .from('agreement_config')
      .select('key, value');

    if (configError) {
      console.error('Config error:', configError);
    }

    // Convert config array to object
    const config: ConfigValues = {};
    if (configData) {
      configData.forEach((item: { key: string; value: string }) => {
        config[item.key] = item.value;
      });
    }

    // Get coach data if email provided
    let coachData = null;
    if (coachEmail) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('name, email, phone, address')
        .eq('email', coachEmail)
        .single();
      coachData = coach;
    }

    // Fetch DOCX file from storage
    const fileUrl = agreement.file_url;
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert DOCX to HTML using mammoth
      const result = await mammoth.convertToHtml({ buffer });
      let html = result.value;

      // Replace variables with config values
      html = replaceVariables(html, config, coachData);

      // Add custom styling
      html = `
        <style>
          .agreement-content {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .agreement-content h1 {
            font-size: 1.5rem;
            color: #1a365d;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            font-weight: bold;
          }
          .agreement-content h2 {
            font-size: 1.25rem;
            color: #2c5282;
            margin-top: 1.25rem;
            margin-bottom: 0.75rem;
            font-weight: bold;
          }
          .agreement-content h3 {
            font-size: 1.1rem;
            color: #2d3748;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
          }
          .agreement-content p {
            margin-bottom: 0.75rem;
          }
          .agreement-content ul, .agreement-content ol {
            margin-left: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .agreement-content li {
            margin-bottom: 0.25rem;
          }
          .agreement-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
          }
          .agreement-content th, .agreement-content td {
            border: 1px solid #e2e8f0;
            padding: 0.5rem;
            text-align: left;
          }
          .agreement-content th {
            background-color: #f7fafc;
            font-weight: 600;
          }
          .agreement-content strong {
            font-weight: 600;
          }
        </style>
        <div class="agreement-content">
          ${html}
        </div>
      `;

      return NextResponse.json({
        success: true,
        agreement: {
          id: agreement.id,
          version: agreement.version,
          title: agreement.title,
          entity_type: agreement.entity_type,
          activated_at: agreement.activated_at
        },
        html,
        warnings: result.messages.map(m => m.message)
      });

    } catch (fetchError) {
      console.error('Document fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load agreement document' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
