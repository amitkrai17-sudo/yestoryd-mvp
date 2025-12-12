import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      studentId,
      studentName,
      studentAge,
      assessments,
      sessionNotes,
      sessions,
    } = body;

    if (!question || !studentName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build context for RAG
    const assessmentContext = assessments?.length
      ? assessments
          .slice(0, 5)
          .map(
            (a: any, i: number) =>
              `Assessment ${i + 1} (${new Date(a.created_at).toLocaleDateString()}): Score ${a.score}/10, WPM: ${a.wpm}, Fluency: ${a.fluency}, Pronunciation: ${a.pronunciation}. Feedback: "${a.feedback}"`
          )
          .join('\n')
      : 'No assessments recorded yet.';

    const sessionNotesContext = sessionNotes?.length
      ? sessionNotes
          .slice(0, 5)
          .map(
            (n: any, i: number) =>
              `Session Note ${i + 1} (${new Date(n.created_at).toLocaleDateString()}): ${n.notes}${n.highlights ? ` Highlights: ${n.highlights}` : ''}${n.areas_to_improve ? ` Areas to improve: ${n.areas_to_improve}` : ''}${n.homework_assigned ? ` Homework: ${n.homework_assigned}` : ''}`
          )
          .join('\n')
      : 'No session notes recorded yet.';

    const sessionsContext = sessions?.length
      ? `Total sessions: ${sessions.length}. Completed: ${sessions.filter((s: any) => s.status === 'completed').length}. Upcoming: ${sessions.filter((s: any) => s.status === 'scheduled').length}.`
      : 'No sessions scheduled yet.';

    // Calculate progress indicators
    const latestScore = assessments?.[0]?.score;
    const previousScore = assessments?.[1]?.score;
    const progressTrend =
      latestScore && previousScore
        ? latestScore > previousScore
          ? 'improving'
          : latestScore < previousScore
          ? 'needs attention'
          : 'stable'
        : 'not enough data';

    const prompt = `You are an AI assistant for a reading coach at Yestoryd. You help coaches understand their students' progress and prepare for sessions.

STUDENT PROFILE:
- Name: ${studentName}
- Age: ${studentAge} years old
- Progress Trend: ${progressTrend}
- ${sessionsContext}

ASSESSMENT HISTORY:
${assessmentContext}

SESSION NOTES FROM COACH:
${sessionNotesContext}

COACH'S QUESTION: "${question}"

Provide a helpful, actionable response. Be specific to this student's data. If asked about progress, reference actual scores and notes. If asked to prepare for a session, use the areas to improve from notes. If asked for parent talking points, highlight both positives and areas of focus.

Keep your response concise (2-3 paragraphs max) but insightful. Use the student's name naturally.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return NextResponse.json({
      success: true,
      response: response,
    });
  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get AI response',
        response: 'Sorry, I encountered an error. Please try again.',
      },
      { status: 500 }
    );
  }
}
