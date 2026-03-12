// ============================================================
// FILE: app/api/group-classes/certificates/generate/route.tsx
// ============================================================
// Generate participation certificates for group class attendees.
// Input: { session_id } (all attended) or { session_id, child_id } (one)
// Output: PDFs stored in Supabase Storage, emailed, in-app notification.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ── PDF Styles ──

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  border: {
    border: '3pt solid #FF0099',
    borderRadius: 8,
    padding: 30,
    minHeight: '90%',
    position: 'relative',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF0099',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#7B008B',
    marginTop: 2,
  },
  certTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 20,
  },
  childName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FF0099',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 1.6,
    marginTop: 8,
  },
  detailsBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FDF2F8',
    borderRadius: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sigSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  sigBox: {
    width: '40%',
    textAlign: 'center',
  },
  sigLine: {
    borderBottom: '1pt solid #D1D5DB',
    marginBottom: 4,
    height: 20,
  },
  sigName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sigTitle: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 2,
  },
  certNumber: {
    position: 'absolute',
    bottom: 10,
    right: 15,
    fontSize: 7,
    color: '#9CA3AF',
  },
  dateText: {
    textAlign: 'center',
    fontSize: 9,
    color: '#6B7280',
    marginTop: 20,
  },
});

// ── Certificate Document ──

interface CertProps {
  childName: string;
  childAge: number | null;
  className: string;
  sessionDate: string;
  instructorName: string;
  certificateNumber: string;
}

const GroupClassCertificate: React.FC<CertProps> = ({
  childName,
  childAge,
  className,
  sessionDate,
  instructorName,
  certificateNumber,
}) => {
  const formattedDate = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.header}>
            <Text style={styles.logo}>Yestoryd</Text>
            <Text style={styles.subtitle}>AI Reading Coach for Kids</Text>
          </View>

          <Text style={styles.certTitle}>Certificate of Participation</Text>

          <Text style={styles.childName}>{childName}</Text>

          <Text style={styles.body}>
            {childAge ? `Age ${childAge} • ` : ''}Successfully participated in
          </Text>
          <Text style={[styles.body, { fontWeight: 'bold', fontSize: 14, marginTop: 4 }]}>
            {className}
          </Text>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Instructor</Text>
              <Text style={styles.detailValue}>{instructorName}</Text>
            </View>
          </View>

          <View style={styles.sigSection}>
            <View style={styles.sigBox}>
              <View style={styles.sigLine} />
              <Text style={styles.sigName}>{instructorName}</Text>
              <Text style={styles.sigTitle}>Session Instructor</Text>
            </View>
            <View style={styles.sigBox}>
              <View style={styles.sigLine} />
              <Text style={styles.sigName}>Rucha Rai</Text>
              <Text style={styles.sigTitle}>Founder & Lead Coach</Text>
            </View>
          </View>

          <Text style={styles.dateText}>Issued on {formattedDate}</Text>
          <Text style={styles.certNumber}>Certificate No: {certificateNumber}</Text>
        </View>
      </Page>
    </Document>
  );
};

// ── Certificate number generator ──

function generateCertNumber(sessionDate: string): string {
  const year = sessionDate.substring(0, 4);
  const shortId = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `YGC-${year}-${shortId}`;
}

// ── POST Handler ──

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { session_id, child_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch session with instructor and class type
    const { data: session } = await supabase
      .from('group_sessions')
      .select(`
        id, title, scheduled_date,
        group_class_types ( name ),
        coaches!group_sessions_instructor_id_fkey ( name )
      `)
      .eq('id', session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classType = Array.isArray(session.group_class_types)
      ? session.group_class_types[0]
      : session.group_class_types;
    const instructor = Array.isArray(session.coaches)
      ? session.coaches[0]
      : session.coaches;
    const className = classType?.name || session.title || 'Group Class';
    const instructorName = (instructor as any)?.name || 'Yestoryd Team';

    // Fetch attended participants
    let participantQuery = supabase
      .from('group_session_participants')
      .select(`
        id, child_id, parent_id,
        children!inner ( id, child_name, age ),
        parents!inner ( id, name, email )
      `)
      .eq('group_session_id', session_id)
      .eq('attendance_status', 'present')
      .is('certificate_sent', null);

    if (child_id) {
      participantQuery = participantQuery.eq('child_id', child_id);
    }

    const { data: participants } = await participantQuery;

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible participants (all may have certificates already)',
        certificates_generated: 0,
      });
    }

    let generated = 0;
    const errors: string[] = [];

    for (const p of participants) {
      const childData = Array.isArray(p.children) ? p.children[0] : p.children;
      const parentData = Array.isArray(p.parents) ? p.parents[0] : p.parents;

      if (!childData) continue;

      const childName = childData.child_name || 'Student';
      const childAge = childData.age;
      const certNumber = generateCertNumber(session.scheduled_date || '2026');

      try {
        // Generate PDF
        const pdfBuffer = await renderToBuffer(
          <GroupClassCertificate
            childName={childName}
            childAge={childAge}
            className={className}
            sessionDate={session.scheduled_date || ''}
            instructorName={instructorName}
            certificateNumber={certNumber}
          />,
        );

        // Upload to Supabase Storage
        const storagePath = `group-class/${session_id}/${p.child_id}_${certNumber}.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from('child-certificates')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadErr) {
          errors.push(`Upload for ${childName}: ${uploadErr.message}`);
          continue;
        }

        // Get signed URL (1 year)
        const { data: signedData } = await supabase.storage
          .from('child-certificates')
          .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

        const certUrl = signedData?.signedUrl || null;

        // Record in group_class_certificates
        await supabase.from('group_class_certificates').insert({
          child_id: p.child_id!,
          group_session_id: session_id,
          registration_id: p.id,
          certificate_number: certNumber,
          certificate_url: certUrl,
          delivered: false,
        });

        // Mark certificate_sent on participant
        await supabase
          .from('group_session_participants')
          .update({ certificate_sent: true, certificate_sent_at: new Date().toISOString() })
          .eq('id', p.id);

        // Send email with PDF attachment
        if (parentData?.email && certUrl) {
          try {
            await sendEmail({
              to: parentData.email,
              subject: `${childName}'s ${className} Certificate`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #FF0099;">Participation Certificate</h2>
                  <p>Hi ${parentData.name || 'Parent'},</p>
                  <p><strong>${childName}</strong> participated in <strong>${className}</strong> on ${session.scheduled_date}. Here's their certificate!</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${certUrl}" style="display: inline-block; background: #FF0099; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Download Certificate
                    </a>
                  </div>
                  <p style="color: #999; font-size: 12px;">Certificate No: ${certNumber}</p>
                </div>
              `,
            });

            // Update delivery status
            await supabase
              .from('group_class_certificates')
              .update({ delivered: true, sent_at: new Date().toISOString(), sent_via: 'email' })
              .eq('registration_id', p.id)
              .eq('group_session_id', session_id);
          } catch (emailErr) {
            errors.push(`Email for ${childName}: ${emailErr instanceof Error ? emailErr.message : 'Unknown'}`);
          }
        }

        // In-app notification
        if (p.parent_id) {
          try {
            await supabase.from('in_app_notifications').insert({
              user_id: p.parent_id,
              user_type: 'parent',
              title: `${childName}'s Certificate Ready!`,
              body: `Download ${childName}'s participation certificate for ${className}.`,
              notification_type: 'success',
              action_url: certUrl || '/group-classes',
              metadata: { session_id, child_id: p.child_id, type: 'group_class_certificate' },
            });
          } catch {
            // Non-critical
          }
        }

        generated++;
      } catch (err) {
        errors.push(`PDF for ${childName}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email || COMPANY_CONFIG.adminEmail,
        user_type: 'admin',
        action: 'group_class_certificates_generated',
        metadata: {
          request_id: requestId,
          session_id,
          class_name: className,
          generated,
          errors: errors.length,
          error_details: errors.length > 0 ? errors : undefined,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      requestId,
      certificates_generated: generated,
      total_eligible: participants.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'certificate_generation_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
