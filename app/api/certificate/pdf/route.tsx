// =============================================================================
// FILE: app/api/certificate/pdf/route.tsx
// PURPOSE: Generate PDF Certificate with Progress Report + Gemini Feedback
// USES: @react-pdf/renderer + Gemini for personalized narrative
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
  },
  // Header
  header: {
    textAlign: 'center',
    marginBottom: 15,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF0099',
    marginBottom: 3,
  },
  certificateTitle: {
    fontSize: 8,
    letterSpacing: 2,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
  },
  childName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#7B008B',
    marginBottom: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  description: {
    fontSize: 10,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 1.4,
  },
  // Badge
  badge: {
    backgroundColor: '#FEF3C7',
    padding: '6 15',
    borderRadius: 15,
    alignSelf: 'center',
    marginBottom: 15,
  },
  badgeText: {
    fontSize: 9,
    color: '#92400E',
    fontWeight: 'bold',
  },
  // Progress Section
  section: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  // Metrics Table
  metricsHeader: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  metricLabel: {
    fontSize: 9,
    color: '#4B5563',
    flex: 1,
  },
  metricBefore: {
    fontSize: 9,
    color: '#EF4444',
    width: 50,
    textAlign: 'center',
  },
  metricAfter: {
    fontSize: 9,
    color: '#10B981',
    width: 50,
    textAlign: 'center',
  },
  metricGrowth: {
    fontSize: 9,
    color: '#7C3AED',
    fontWeight: 'bold',
    width: 55,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 7,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  // Overall Progress
  overallBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    textAlign: 'center',
  },
  overallLabel: {
    fontSize: 8,
    color: '#065F46',
  },
  overallValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  // Feedback Section
  feedbackSection: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
  },
  feedbackTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9A3412',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 9,
    color: '#4B5563',
    lineHeight: 1.5,
    textAlign: 'justify',
  },
  // Strengths & Achievements
  strengthsSection: {
    marginBottom: 15,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
  },
  columnTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 8,
    color: '#4B5563',
    marginBottom: 3,
    paddingLeft: 8,
  },
  // Footer
  footer: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '40%',
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#9CA3AF',
    marginTop: 25,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  signatureTitle: {
    fontSize: 7,
    color: '#6B7280',
  },
  certNumber: {
    fontSize: 7,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
  },
  dateBox: {
    marginTop: 10,
    textAlign: 'center',
  },
  dateLabel: {
    fontSize: 7,
    color: '#6B7280',
  },
  dateValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  // Border
  border: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 6,
    padding: 20,
  },
});

// Certificate Component
interface CertificateProps {
  childName: string;
  childAge: number;
  coachName: string;
  certificateNumber: string;
  completedDate: string;
  programDuration: string;
  sessionsCompleted: number;
  initialScores: {
    overall: number;
    fluency: number;
    pronunciation: number;
    comprehension: number;
    wpm: number;
  };
  finalScores: {
    overall: number;
    fluency: number;
    pronunciation: number;
    comprehension: number;
    wpm: number;
  };
  geminiFeedback: {
    summary: string;
    strengths: string[];
    achievements: string[];
    recommendation: string;
  };
}

const CertificateDocument: React.FC<CertificateProps> = ({
  childName,
  childAge,
  coachName,
  certificateNumber,
  completedDate,
  programDuration,
  sessionsCompleted,
  initialScores,
  finalScores,
  geminiFeedback,
}) => {
  const calculateGrowth = (before: number, after: number) => {
    if (before === 0) return '+100%';
    const growth = Math.round(((after - before) / before) * 100);
    return growth >= 0 ? `+${growth}%` : `${growth}%`;
  };

  const overallGrowth = Math.round(
    ((finalScores.overall - initialScores.overall) / Math.max(initialScores.overall, 1)) * 100
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Yestoryd</Text>
            <Text style={styles.certificateTitle}>Certificate of Achievement</Text>
            <Text style={styles.mainTitle}>Reading Excellence Program</Text>
          </View>

          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🏆 {sessionsCompleted} Sessions • {programDuration}</Text>
          </View>

          {/* Child Name */}
          <Text style={styles.childName}>{childName}</Text>
          <Text style={styles.description}>
            Age {childAge} • Coached by {coachName}
          </Text>

          {/* Progress Report */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Progress Report</Text>

            {/* Header Row */}
            <View style={styles.metricsHeader}>
              <Text style={[styles.headerText, { flex: 1 }]}>METRIC</Text>
              <Text style={[styles.headerText, { width: 50, textAlign: 'center' }]}>BEFORE</Text>
              <Text style={[styles.headerText, { width: 50, textAlign: 'center' }]}>AFTER</Text>
              <Text style={[styles.headerText, { width: 55, textAlign: 'right' }]}>GROWTH</Text>
            </View>

            {/* Metrics */}
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Overall Score</Text>
              <Text style={styles.metricBefore}>{initialScores.overall}/10</Text>
              <Text style={styles.metricAfter}>{finalScores.overall}/10</Text>
              <Text style={styles.metricGrowth}>{calculateGrowth(initialScores.overall, finalScores.overall)}</Text>
            </View>

            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Reading Fluency</Text>
              <Text style={styles.metricBefore}>{initialScores.fluency}/10</Text>
              <Text style={styles.metricAfter}>{finalScores.fluency}/10</Text>
              <Text style={styles.metricGrowth}>{calculateGrowth(initialScores.fluency, finalScores.fluency)}</Text>
            </View>

            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Pronunciation</Text>
              <Text style={styles.metricBefore}>{initialScores.pronunciation}/10</Text>
              <Text style={styles.metricAfter}>{finalScores.pronunciation}/10</Text>
              <Text style={styles.metricGrowth}>{calculateGrowth(initialScores.pronunciation, finalScores.pronunciation)}</Text>
            </View>

            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Reading Speed (WPM)</Text>
              <Text style={styles.metricBefore}>{initialScores.wpm}</Text>
              <Text style={styles.metricAfter}>{finalScores.wpm}</Text>
              <Text style={styles.metricGrowth}>{calculateGrowth(initialScores.wpm, finalScores.wpm)}</Text>
            </View>

            {/* Overall */}
            <View style={styles.overallBox}>
              <Text style={styles.overallLabel}>Overall Improvement</Text>
              <Text style={styles.overallValue}>+{Math.max(0, overallGrowth)}%</Text>
            </View>
          </View>

          {/* Gemini Feedback */}
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackTitle}>✨ Coach's Assessment</Text>
            <Text style={styles.feedbackText}>{geminiFeedback.summary}</Text>
          </View>

          {/* Strengths & Achievements */}
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>💪 Strengths</Text>
              {geminiFeedback.strengths.slice(0, 4).map((strength, i) => (
                <Text key={i} style={styles.bulletPoint}>• {strength}</Text>
              ))}
            </View>
            <View style={[styles.column, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.columnTitle, { color: '#1E40AF' }]}>🎯 Achievements</Text>
              {geminiFeedback.achievements.slice(0, 4).map((achievement, i) => (
                <Text key={i} style={styles.bulletPoint}>• {achievement}</Text>
              ))}
            </View>
          </View>

          {/* Recommendation */}
          {geminiFeedback.recommendation && (
            <View style={{ marginTop: 10, padding: 8, backgroundColor: '#F5F3FF', borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: '#5B21B6', fontWeight: 'bold' }}>📚 Next Steps</Text>
              <Text style={{ fontSize: 8, color: '#4B5563', marginTop: 3 }}>{geminiFeedback.recommendation}</Text>
            </View>
          )}

          {/* Signatures */}
          <View style={styles.footer}>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{coachName}</Text>
              <Text style={styles.signatureTitle}>Reading Coach</Text>
            </View>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>Rucha Rai</Text>
              <Text style={styles.signatureTitle}>Founder & Lead Coach</Text>
            </View>
          </View>

          {/* Date & Certificate Number */}
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Date of Completion</Text>
            <Text style={styles.dateValue}>{completedDate}</Text>
          </View>
          <Text style={styles.certNumber}>Certificate No: {certificateNumber}</Text>
        </View>
      </Page>
    </Document>
  );
};

// Generate Gemini feedback
async function generateGeminiFeedback(data: {
  childName: string;
  childAge: number;
  initialScores: any;
  finalScores: any;
  initialFeedback?: string;
  finalFeedback?: string;
  sessionsCompleted: number;
}): Promise<{
  summary: string;
  strengths: string[];
  achievements: string[];
  recommendation: string;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are a reading coach writing a certificate feedback for a child who completed a 3-month reading program.

CHILD DETAILS:
- Name: ${data.childName}
- Age: ${data.childAge} years
- Sessions Completed: ${data.sessionsCompleted}

INITIAL ASSESSMENT (Before Program):
- Overall Score: ${data.initialScores.overall}/10
- Fluency: ${data.initialScores.fluency}/10
- Pronunciation: ${data.initialScores.pronunciation}/10
- Reading Speed: ${data.initialScores.wpm} WPM
${data.initialFeedback ? `- AI Feedback: ${data.initialFeedback}` : ''}

FINAL ASSESSMENT (After Program):
- Overall Score: ${data.finalScores.overall}/10
- Fluency: ${data.finalScores.fluency}/10
- Pronunciation: ${data.finalScores.pronunciation}/10
- Reading Speed: ${data.finalScores.wpm} WPM
${data.finalFeedback ? `- AI Feedback: ${data.finalFeedback}` : ''}

Generate a CERTIFICATE FEEDBACK in JSON format with:
1. "summary": A warm, encouraging 2-3 sentence summary of the child's reading journey (personalized, specific to their improvement)
2. "strengths": Array of 4 specific strengths the child demonstrated (based on their scores and improvement)
3. "achievements": Array of 4 specific achievements during the program (make them feel proud)
4. "recommendation": One sentence suggesting what they should focus on next to continue improving

Keep the tone warm, encouraging, and celebratory. This goes on their certificate!

Return ONLY valid JSON, no markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Gemini feedback error:', error);
    // Return default feedback
    return {
      summary: `${data.childName} has shown remarkable progress in their reading journey! Their dedication and hard work over the past 3 months have resulted in significant improvements across all reading skills.`,
      strengths: [
        'Consistent effort throughout the program',
        'Improved reading confidence',
        'Better word recognition',
        'Enhanced reading fluency',
      ],
      achievements: [
        'Completed all coaching sessions',
        'Improved overall reading score',
        'Increased reading speed',
        'Developed love for reading',
      ],
      recommendation: 'Continue daily reading practice for 15-20 minutes to maintain and build on this excellent progress.',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollment');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'Enrollment ID required' }, { status: 400 });
    }

    // Get enrollment with all details
    const { data: enrollment, error } = await supabase
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
          age,
          assessment_score
        ),
        coaches!coach_id (
          id,
          name
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (!enrollment.child_id) {
      return NextResponse.json({ error: 'Invalid enrollment: missing child_id' }, { status: 400 });
    }

    // Get ALL assessment results for this child (table may not exist yet — cast to any)
    const { data: assessments } = await (supabase as any)
      .from('assessment_results')
      .select('*')
      .eq('child_id', enrollment.child_id)
      .order('created_at', { ascending: true });

    // Also check children table for initial assessment data
    const { data: childData } = await supabase
      .from('children')
      .select('latest_assessment_score')
      .eq('id', enrollment.child_id)
      .single();

    // Parse initial scores (from first assessment or children table)
    const initialAssessment = assessments?.find((a: any) => !a.assessment_type || a.assessment_type === 'initial');
    const finalAssessment = assessments?.find((a: any) => a.assessment_type === 'final') ||
                           (assessments && assessments.length > 1 ? assessments[assessments.length - 1] : null);

    const initialScores = {
      overall: initialAssessment?.overall_score || initialAssessment?.score || childData?.latest_assessment_score || 5,
      fluency: initialAssessment?.fluency_score || 5,
      pronunciation: initialAssessment?.pronunciation_score || 5,
      comprehension: initialAssessment?.comprehension_score || 5,
      wpm: initialAssessment?.wpm || 40,
    };

    // If no final assessment, estimate improvement
    const finalScores = finalAssessment ? {
      overall: finalAssessment.overall_score || finalAssessment.score || initialScores.overall + 2,
      fluency: finalAssessment.fluency_score || initialScores.fluency + 2,
      pronunciation: finalAssessment.pronunciation_score || initialScores.pronunciation + 2,
      comprehension: finalAssessment.comprehension_score || initialScores.comprehension + 2,
      wpm: finalAssessment.wpm || initialScores.wpm + 15,
    } : {
      overall: Math.min(10, initialScores.overall + 2),
      fluency: Math.min(10, initialScores.fluency + 2),
      pronunciation: Math.min(10, initialScores.pronunciation + 2),
      comprehension: Math.min(10, initialScores.comprehension + 2),
      wpm: initialScores.wpm + 15,
    };

    // Get initial and final feedback text
    const initialFeedback = initialAssessment?.ai_feedback || initialAssessment?.summary || '';
    const finalFeedback = finalAssessment?.ai_feedback || finalAssessment?.summary || '';

    // Count completed sessions
    const { count: sessionsCompleted } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', enrollment.child_id)
      .eq('status', 'completed');

    const childName = (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'Student';
    const childAge = (enrollment.children as any)?.age || 8;
    const coachName = (enrollment.coaches as any)?.name || 'Coach';
    const certificateNumber = enrollment.certificate_number || 
      `YC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

    const completedDate = enrollment.completed_at
      ? new Date(enrollment.completed_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Calculate program duration
    const startDate = enrollment.program_start ? new Date(enrollment.program_start) : new Date();
    const endDate = enrollment.completed_at ? new Date(enrollment.completed_at) : new Date();
    const monthsDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const programDuration = `${monthsDiff || 3} Months`;

    // Generate Gemini feedback
    const geminiFeedback = await generateGeminiFeedback({
      childName,
      childAge,
      initialScores,
      finalScores,
      initialFeedback,
      finalFeedback,
      sessionsCompleted: sessionsCompleted || 9,
    });

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <CertificateDocument
        childName={childName}
        childAge={childAge}
        coachName={coachName}
        certificateNumber={certificateNumber}
        completedDate={completedDate}
        programDuration={programDuration}
        sessionsCompleted={sessionsCompleted || 9}
        initialScores={initialScores}
        finalScores={finalScores}
        geminiFeedback={geminiFeedback}
      />
    );

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Yestoryd-Certificate-${childName.replace(/\s+/g, '-')}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
  }
}