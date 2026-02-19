// =============================================================================
// FILE: app/api/completion/report/[enrollmentId]/route.ts
// PURPOSE: Generate comprehensive progress report using Gemini AI
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { capitalizeName } from '@/lib/utils';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ReportData {
  child: {
    name: string;
    age: number;
    grade: string;
  };
  coach: {
    name: string;
  };
  program: {
    startDate: string;
    endDate: string;
    totalSessions: number;
  };
  initialAssessment: {
    clarityScore: number;
    fluencyScore: number;
    speedScore: number;
    wpm: number;
    strengths: string[];
    areasToImprove: string[];
    feedback: string;
  };
  finalAssessment: {
    clarityScore: number;
    fluencyScore: number;
    speedScore: number;
    wpm: number;
    strengths: string[];
    areasToImprove: string[];
    feedback: string;
  };
  sessionSummaries: Array<{
    sessionNumber: number;
    date: string;
    type: 'coaching' | 'parent_checkin';
    summary: string;
    highlights: string[];
    focusAreas: string[];
  }>;
  elearningProgress?: {
    modulesCompleted: number;
    totalModules: number;
    quizScores: number[];
    timeSpent: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // Fetch all required data
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        child:children(
          id, child_name, age, grade
        ),
        coach:coaches!coach_id(id, name, email)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (!enrollment.child_id || !enrollment.child) {
      return NextResponse.json({ error: 'Enrollment has no child assigned' }, { status: 400 });
    }

    // NOTE: Assessment data queries disabled - assessment columns don't exist in children table
    // Would need to query child_rag_profiles or another assessment table
    const initialAssessment = null;
    const finalAssessment = null;

    // Get session summaries
    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select('session_number, scheduled_date, session_type, coach_notes, status')
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed')
      .order('session_number', { ascending: true });

    // Get e-learning progress from consolidated tables
    const { data: gamificationData } = await supabase
      .from('el_child_gamification')
      .select('total_units_completed, total_quizzes_completed, total_time_minutes')
      .eq('child_id', enrollment.child_id)
      .single();

    const elearningProgress = gamificationData ? {
      modules_completed: gamificationData.total_units_completed || 0,
      quiz_scores: [],
      time_spent_minutes: gamificationData.total_time_minutes || 0,
    } : null;

    // Prepare data for Gemini
    const reportData: ReportData = {
      child: {
        name: capitalizeName(enrollment.child.child_name),
        age: enrollment.child.age || 0,
        grade: enrollment.child.grade || 'Not specified',
      },
      coach: {
        name: capitalizeName(enrollment.coach?.name || 'Coach'),
      },
      program: {
        startDate: enrollment.program_start || new Date().toISOString(),
        endDate: enrollment.program_end || new Date().toISOString(),
        totalSessions: sessions?.length || 0,
      },
      initialAssessment: {
        clarityScore: 5,
        fluencyScore: 5,
        speedScore: 5,
        wpm: 0,
        strengths: [],
        areasToImprove: [],
        feedback: '',
      },
      finalAssessment: {
        clarityScore: 5,
        fluencyScore: 5,
        speedScore: 5,
        wpm: 0,
        strengths: [],
        areasToImprove: [],
        feedback: '',
      },
      sessionSummaries: sessions?.map((s, i) => ({
        sessionNumber: s.session_number || i + 1,
        date: s.scheduled_date,
        type: s.session_type as 'coaching' | 'parent_checkin',
        summary: s.coach_notes || '',
        highlights: [],
        focusAreas: [],
      })) || [],
      elearningProgress: elearningProgress ? {
        modulesCompleted: elearningProgress.modules_completed || 0,
        totalModules: 200, // Target
        quizScores: elearningProgress.quiz_scores || [],
        timeSpent: elearningProgress.time_spent_minutes || 0,
      } : undefined,
    };

    // Generate report using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are an expert reading coach and child development specialist. Generate a comprehensive, warm, and encouraging progress report for a child who completed a 12-week reading coaching program.

## Child Information
- Name: ${reportData.child.name}
- Age: ${reportData.child.age} years
- Grade: ${reportData.child.grade}
- Coach: ${reportData.coach.name}
- Program Duration: ${reportData.program.startDate} to ${reportData.program.endDate}
- Sessions Completed: ${reportData.program.totalSessions}

## Initial Assessment (Before Program)
- Clarity Score: ${reportData.initialAssessment.clarityScore}/10
- Fluency Score: ${reportData.initialAssessment.fluencyScore}/10
- Speed Score: ${reportData.initialAssessment.speedScore}/10
- Reading Speed: ${reportData.initialAssessment.wpm} WPM
- Initial Strengths: ${reportData.initialAssessment.strengths.join(', ') || 'Being assessed'}
- Initial Areas to Improve: ${reportData.initialAssessment.areasToImprove.join(', ') || 'Being assessed'}

## Final Assessment (After Program)
- Clarity Score: ${reportData.finalAssessment.clarityScore}/10
- Fluency Score: ${reportData.finalAssessment.fluencyScore}/10
- Speed Score: ${reportData.finalAssessment.speedScore}/10
- Reading Speed: ${reportData.finalAssessment.wpm} WPM
- Current Strengths: ${reportData.finalAssessment.strengths.join(', ') || 'See below'}
- Areas for Continued Growth: ${reportData.finalAssessment.areasToImprove.join(', ') || 'See below'}

## Session Highlights
${reportData.sessionSummaries.map(s => `Session ${s.sessionNumber} (${s.type}): ${s.summary}`).join('\n') || 'Detailed summaries available in session records.'}

${reportData.elearningProgress ? `## E-Learning Progress
- Modules Completed: ${reportData.elearningProgress.modulesCompleted}
- Average Quiz Score: ${reportData.elearningProgress.quizScores.length > 0 ? Math.round(reportData.elearningProgress.quizScores.reduce((a, b) => a + b, 0) / reportData.elearningProgress.quizScores.length) : 'N/A'}%
- Time Spent Learning: ${Math.round(reportData.elearningProgress.timeSpent / 60)} hours` : ''}

---

Generate a comprehensive progress report with the following sections in JSON format:

{
  "executiveSummary": {
    "headline": "A powerful one-line achievement headline for ${reportData.child.name}",
    "keyAchievement": "The single most impressive improvement",
    "overallGrowth": "Summary of overall progress (2-3 sentences)"
  },
  "assessmentComparison": {
    "clarityImprovement": {
      "before": ${reportData.initialAssessment.clarityScore},
      "after": ${reportData.finalAssessment.clarityScore},
      "interpretation": "What this improvement means in practical terms"
    },
    "fluencyImprovement": {
      "before": ${reportData.initialAssessment.fluencyScore},
      "after": ${reportData.finalAssessment.fluencyScore},
      "interpretation": "What this improvement means in practical terms"
    },
    "speedImprovement": {
      "before": ${reportData.initialAssessment.speedScore},
      "after": ${reportData.finalAssessment.speedScore},
      "wpmBefore": ${reportData.initialAssessment.wpm},
      "wpmAfter": ${reportData.finalAssessment.wpm},
      "interpretation": "What this improvement means in practical terms"
    },
    "biggestWin": "The most significant area of improvement"
  },
  "journeyTimeline": {
    "foundation": {
      "weeks": "1-4",
      "focus": "What was worked on",
      "achievements": ["Achievement 1", "Achievement 2"]
    },
    "building": {
      "weeks": "5-8",
      "focus": "What was worked on",
      "achievements": ["Achievement 1", "Achievement 2"]
    },
    "mastery": {
      "weeks": "9-12",
      "focus": "What was worked on",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  },
  "skillsAnalysis": {
    "masteredSkills": [
      {"skill": "Skill name", "evidence": "How we know this was mastered"}
    ],
    "emergingSkills": [
      {"skill": "Skill name", "progress": "Current progress level and next steps"}
    ]
  },
  "recommendations": {
    "homePractice": ["Activity 1", "Activity 2", "Activity 3"],
    "continuedLearning": "Recommendation for next steps (e-learning, re-enrollment, etc.)",
    "readingList": ["Book 1 recommendation with age-appropriate reason", "Book 2", "Book 3"]
  },
  "coachNote": {
    "personalMessage": "A warm, personal message from ${reportData.coach.name} to ${reportData.child.name}",
    "favoriteMemory": "A highlight from the coaching journey",
    "encouragement": "Words of encouragement for continued success"
  },
  "parentGuidance": {
    "maintainProgress": ["Tip 1", "Tip 2", "Tip 3"],
    "warningsigns": ["Sign to watch for that might indicate regression"],
    "celebrationIdeas": ["Way to celebrate this achievement"]
  }
}

Make the report warm, encouraging, specific to ${reportData.child.name}'s journey, and actionable for parents. Use specific numbers and improvements where available. The tone should be professional yet warm, celebrating the child's achievements while providing practical guidance.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response
    let reportContent;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      reportContent = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Return a structured fallback
      reportContent = {
        executiveSummary: {
          headline: `${reportData.child.name} Completes Reading Journey!`,
          keyAchievement: `Improved reading scores across all metrics`,
          overallGrowth: `${reportData.child.name} has shown wonderful progress throughout the program.`
        },
        error: 'Full report generation pending',
        rawResponse: responseText.substring(0, 500)
      };
    }

    // Calculate improvement percentages
    const improvements = {
      clarity: reportData.finalAssessment.clarityScore - reportData.initialAssessment.clarityScore,
      fluency: reportData.finalAssessment.fluencyScore - reportData.initialAssessment.fluencyScore,
      speed: reportData.finalAssessment.speedScore - reportData.initialAssessment.speedScore,
      wpm: reportData.finalAssessment.wpm - reportData.initialAssessment.wpm,
    };

    // Store report in completion_certificates table
    const certificateNumber = `YC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const { data: certificate, error: certError } = await supabase
      .from('completion_certificates')
      .upsert({
        enrollment_id: enrollmentId,
        child_id: enrollment.child_id,
        coach_id: enrollment.coach_id,
        certificate_number: certificateNumber,
        initial_assessment: reportData.initialAssessment,
        final_assessment: reportData.finalAssessment,
        improvement_data: improvements,
        report_content: reportContent,
        child_name: reportData.child.name,
        coach_name: reportData.coach.name,
        program_start_date: reportData.program.startDate,
        program_end_date: reportData.program.endDate,
        coaching_sessions_completed: reportData.sessionSummaries.filter(s => s.type === 'coaching').length,
        parent_checkins_completed: reportData.sessionSummaries.filter(s => s.type === 'parent_checkin').length,
        issued_at: new Date().toISOString(),
      }, {
        onConflict: 'enrollment_id',
      })
      .select()
      .single();

    if (certError) {
      console.error('Error storing certificate:', certError);
    }

    return NextResponse.json({
      success: true,
      certificateNumber,
      report: reportContent,
      improvements,
      childName: reportData.child.name,
      coachName: reportData.coach.name,
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
