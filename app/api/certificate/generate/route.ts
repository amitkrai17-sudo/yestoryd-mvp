// =============================================================================
// FILE: app/api/certificate/generate/route.ts
// PURPOSE: Generate PDF completion certificate
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollment');

    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'Enrollment ID required' },
        { status: 400 }
      );
    }

    // Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        certificate_number,
        completed_at,
        program_start,
        program_end,
        child_id,
        coach_id,
        children!child_id (
          id,
          name,
          child_name,
          age
        ),
        coaches!coach_id (
          id,
          name
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Check if completed
    if (enrollment.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Program not yet completed' },
        { status: 400 }
      );
    }

    const childName = (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'Student';
    const coachName = (enrollment.coaches as any)?.name || 'Coach';
    const certificateNumber = enrollment.certificate_number || `YC-${new Date().getFullYear()}-00001`;
    const completedDate = enrollment.completed_at 
      ? new Date(enrollment.completed_at).toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Generate SVG certificate (can be converted to PDF later)
    const certificateSVG = generateCertificateSVG({
      childName,
      coachName,
      certificateNumber,
      completedDate,
    });

    // Convert SVG to PDF using a simple HTML wrapper
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate - ${childName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #f3e8ff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .certificate {
      width: 1000px;
      height: 700px;
      background: white;
      border: 8px solid #f59e0b;
      border-radius: 16px;
      position: relative;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .border-inner {
      border: 2px solid #fbbf24;
      border-radius: 8px;
      height: 100%;
      padding: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
    }
    .header {
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #db2777;
      margin-bottom: 10px;
    }
    .title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .main-title {
      font-size: 36px;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .content {
      text-align: center;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .presented {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .name {
      font-size: 48px;
      color: #7c3aed;
      font-style: italic;
      margin-bottom: 20px;
      border-bottom: 2px solid #f59e0b;
      padding-bottom: 10px;
      display: inline-block;
    }
    .description {
      font-size: 18px;
      color: #4b5563;
      max-width: 600px;
      margin: 0 auto 20px;
      line-height: 1.6;
    }
    .achievement {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #fef3c7, #fce7f3);
      padding: 10px 24px;
      border-radius: 50px;
      font-size: 14px;
      color: #92400e;
      font-weight: 600;
    }
    .footer {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #9ca3af;
      margin-bottom: 5px;
      margin-top: 40px;
    }
    .signature-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
    .signature-title {
      font-size: 12px;
      color: #6b7280;
    }
    .cert-number {
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    .date-box {
      text-align: center;
    }
    .date-label {
      font-size: 12px;
      color: #6b7280;
    }
    .date-value {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
    .medal {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #f59e0b, #fbbf24);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
    }
    .corner-decoration {
      position: absolute;
      width: 60px;
      height: 60px;
      border: 3px solid #f59e0b;
    }
    .corner-tl { top: 20px; left: 20px; border-right: none; border-bottom: none; }
    .corner-tr { top: 20px; right: 20px; border-left: none; border-bottom: none; }
    .corner-bl { bottom: 20px; left: 20px; border-right: none; border-top: none; }
    .corner-br { bottom: 20px; right: 20px; border-left: none; border-top: none; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="corner-decoration corner-tl"></div>
    <div class="corner-decoration corner-tr"></div>
    <div class="corner-decoration corner-bl"></div>
    <div class="corner-decoration corner-br"></div>
    
    <div class="border-inner">
      <div class="header">
        <div class="logo">Yestoryd</div>
        <div class="title">Certificate of Completion</div>
        <div class="main-title">Reading Excellence Program</div>
      </div>
      
      <div class="content">
        <div class="presented">This certificate is proudly presented to</div>
        <div class="name">${childName}</div>
        <div class="description">
          for successfully completing the 3-Month Reading Coaching Program,
          demonstrating dedication, progress, and a love for reading.
        </div>
        <div class="achievement">
          🏆 9 Sessions Completed • Certified Reader
        </div>
      </div>
      
      <div class="footer">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-name">${coachName}</div>
          <div class="signature-title">Reading Coach</div>
        </div>
        
        <div class="cert-number">
          Certificate No: ${certificateNumber}
        </div>
        
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-name">Rucha Rai</div>
          <div class="signature-title">Founder & Lead Coach</div>
        </div>
      </div>
      
      <div class="date-box" style="margin-top: 15px;">
        <div class="date-label">Date of Completion</div>
        <div class="date-value">${completedDate}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Return HTML that can be printed to PDF
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="Yestoryd-Certificate-${childName}.html"`,
      },
    });

  } catch (error: any) {
    console.error('Certificate generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}

function generateCertificateSVG(data: {
  childName: string;
  coachName: string;
  certificateNumber: string;
  completedDate: string;
}) {
  // SVG generation for future PDF conversion
  return `
    <svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
      <!-- Certificate content would go here -->
    </svg>
  `;
}
