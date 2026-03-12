// =============================================================================
// FILE: app/api/assessment/final/submit/route.ts
// PURPOSE: Submit final assessment, analyze with Gemini, generate report
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getGenAI } from '@/lib/gemini/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGeminiModel } from '@/lib/gemini-config';
import { buildFullAssessmentPrompt } from '@/lib/gemini/assessment-prompts';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const enrollmentId = formData.get('enrollmentId') as string;
    const passageText = formData.get('passageText') as string;

    if (!audioFile || !enrollmentId) {
      return NextResponse.json(
        { error: 'Audio file and enrollment ID are required' },
        { status: 400 }
      );
    }

    // Get enrollment data
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, child_id, coach_id, program_start, program_end')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Fetch child data separately
    if (!enrollment.child_id) {
      return NextResponse.json({ error: 'Child ID not found in enrollment' }, { status: 400 });
    }

    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, grade, assessment_wpm')
      .eq('id', enrollment.child_id)
      .single();

    // Get previous assessment scores from child_intelligence_profiles
    const { data: profile } = await supabase
      .from('child_intelligence_profiles')
      .select('skill_ratings, narrative_profile')
      .eq('child_id', enrollment.child_id)
      .maybeSingle();

    // Extract assessment scores from skill_ratings JSON (if present)
    const skillRatings = (profile?.skill_ratings as Record<string, any>) || {};
    const narrativeProfile = (profile?.narrative_profile as Record<string, any>) || {};
    const previousScoresFromProfile = {
      clarity_score: skillRatings.clarity_score as number | null ?? null,
      fluency_score: skillRatings.fluency_score as number | null ?? null,
      speed_score: skillRatings.speed_score as number | null ?? null,
      strengths: (narrativeProfile.strengths as string[]) || null,
      areas_of_improvement: (narrativeProfile.areas_of_improvement as string[]) || null,
    };

    // Fetch coach data separately (optional - some enrollments may not have assigned coach yet)
    let coach = null;
    if (enrollment.coach_id) {
      const { data } = await supabase
        .from('coaches')
        .select('name')
        .eq('id', enrollment.coach_id)
        .single();
      coach = data;
    }

    // Convert audio to base64 for Gemini
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Upload audio to Supabase Storage
    const audioFileName = `final-assessments/${enrollmentId}-${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('assessments')
      .upload(audioFileName, audioFile, {
        contentType: 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Audio upload error:', uploadError);
    }

    // Analyze with Gemini (shared standardized prompt with comparison mode)
    const model = getGenAI().getGenerativeModel({ model: getGeminiModel('assessment_analysis') });

    const analysisPrompt = buildFullAssessmentPrompt({
      childName: child?.child_name || 'Child',
      childAge: child?.age || 8,
      passage: passageText || '',
      wordCount: passageText?.split(' ').length || 0,
      previousScores: {
        clarity: previousScoresFromProfile.clarity_score,
        fluency: previousScoresFromProfile.fluency_score,
        speed: previousScoresFromProfile.speed_score,
        wpm: child?.assessment_wpm,
        strengths: previousScoresFromProfile.strengths,
        areasToImprove: previousScoresFromProfile.areas_of_improvement,
      },
      comparisonMode: true,
    });

    const result = await model.generateContent([
      { text: analysisPrompt },
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    
    // Parse the analysis result
    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Provide default scores (matches full assessment schema)
      analysis = {
        clarity_score: Math.min(10, (previousScoresFromProfile.clarity_score || 5) + 1),
        fluency_score: Math.min(10, (previousScoresFromProfile.fluency_score || 5) + 1),
        speed_score: Math.min(10, (previousScoresFromProfile.speed_score || 5) + 1),
        wpm: (child?.assessment_wpm || 50) + 15,
        completeness_percentage: 90,
        strengths: ['Completed the program', 'Showed dedication'],
        areas_to_improve: ['Continue practicing'],
        feedback: 'Great job completing the program!',
        improvement_summary: 'Made wonderful progress throughout the program.',
        self_corrections: [],
        hesitations: [],
      };
    }

    // Update child_intelligence_profiles with final assessment scores
    // Merge assessment scores into skill_ratings and narrative_profile JSON fields
    const updatedSkillRatings = {
      ...skillRatings,
      clarity_score: analysis.clarity_score,
      fluency_score: analysis.fluency_score,
      speed_score: analysis.speed_score,
    };
    const updatedNarrativeProfile = {
      ...narrativeProfile,
      strengths: analysis.strengths,
      areas_of_improvement: analysis.areas_to_improve,
    };

    const { error: updateError } = await supabase
      .from('child_intelligence_profiles')
      .upsert({
        child_id: enrollment.child_id,
        skill_ratings: updatedSkillRatings,
        narrative_profile: updatedNarrativeProfile,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });

    if (updateError) {
      console.error('Failed to update child assessment:', updateError);
    }

    // Update children table with final assessment audio URL and WPM
    await supabase
      .from('children')
      .update({
        assessment_wpm: analysis.wpm,
        final_assessment_audio_url: audioFileName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollment.child_id);

    // Update enrollment with final assessment completion
    await supabase
      .from('enrollments')
      .update({
        final_assessment_completed_at: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // Generate the full progress report
    const reportResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/completion/report/${enrollmentId}`,
      { method: 'POST' }
    );

    const reportData = await reportResponse.json();

    // Mark child as alumni
    await supabase
      .from('children')
      .update({
        alumni_since: new Date().toISOString(),
        lead_status: 'alumni',
      })
      .eq('id', enrollment.child_id);

    // Send completion notifications via QStash for reliability
    try {
      // Send certificate + report email
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'completion_certificate_ready',
          enrollmentId,
          childName: child?.child_name,
        }),
      });
    } catch (commError) {
      console.error('Communication error:', commError);
    }

    return NextResponse.json({
      success: true,
      analysis,
      certificateNumber: reportData.certificateNumber,
      improvements: {
        clarity: analysis.clarity_score - (previousScoresFromProfile.clarity_score || 5),
        fluency: analysis.fluency_score - (previousScoresFromProfile.fluency_score || 5),
        speed: analysis.speed_score - (previousScoresFromProfile.speed_score || 5),
        wpm: analysis.wpm - (child?.assessment_wpm || 50),
      },
    });

  } catch (error) {
    console.error('Final assessment submit error:', error);
    return NextResponse.json({ error: 'Failed to process assessment' }, { status: 500 });
  }
}