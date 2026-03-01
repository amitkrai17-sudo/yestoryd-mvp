'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Trophy, ChevronDown, ChevronUp,
  Clock, AlertCircle, ArrowRight,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';
import { DiagnosticForm } from '@/components/coach/diagnostic-form';
import { getExitAssessmentFields } from '@/components/coach/diagnostic-form/schemas';

export default function ExitAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [session, setSession] = useState<any>(null);
  const [child, setChild] = useState<any>(null);
  const [ageBand, setAgeBand] = useState('building');
  const [diagnosticBaseline, setDiagnosticBaseline] = useState<Record<string, any> | null>(null);
  const [existingData, setExistingData] = useState<Record<string, any> | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const [seasonResult, setSeasonResult] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coach/sessions/${sessionId}/exit-assessment`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to load');
          setLoading(false);
          return;
        }

        setSession(data.session);
        setChild(data.child);
        setAgeBand(data.age_band);
        setDiagnosticBaseline(data.diagnostic_baseline?.data || null);

        if (data.exit_assessment) {
          setExistingData(data.exit_assessment.data);
        }
      } catch {
        setError('Failed to load exit assessment data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  const handleSubmit = async (formData: Record<string, any>) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/coach/sessions/${sessionId}/exit-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitData: formData }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      if (data.season_completion?.success) {
        setSeasonResult(data.season_completion);
        setSuccess(`Exit assessment saved! Season ${data.season_completion.season_number} marked as complete.`);
      } else {
        setSuccess('Exit assessment saved.');
      }
      setExistingData(formData);
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Parent-friendly labels for baseline comparison
  const SKILL_LABELS: Record<string, string> = {
    letter_sounds_known: 'Letter Sounds Known',
    can_blend: 'Can Blend',
    rhyme_recognition: 'Rhyme Recognition',
    sight_words_known: 'Sight Words Known',
    listening_comprehension: 'Listening',
    confidence_level: 'Confidence',
    cvc_decode: 'CVC Decoding',
    oral_reading_fluency: 'Oral Fluency',
    prosody: 'Prosody',
    literal_comprehension: 'Comprehension',
    reading_level: 'Reading Level',
    evaluative_comprehension: 'Evaluative Comprehension',
    vocabulary_strategy: 'Vocabulary Strategy',
    grammar_accuracy: 'Grammar',
    writing_composition: 'Writing',
    reading_stamina_minutes: 'Reading Stamina (min)',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF]" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-white mb-2">{error}</p>
          <button onClick={() => router.back()} className="text-[#00ABFF] font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  // Use exit assessment fields instead of diagnostic-only fields
  const exitFields = getExitAssessmentFields(ageBand);

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-surface-2 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-text-tertiary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Exit Assessment
            </h1>
            <p className="text-xs text-text-tertiary">
              Season Finale {child ? `— ${child.child_name}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Season Finale Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">Season Finale Assessment</p>
              <p className="text-text-tertiary text-xs mt-0.5">
                Complete this assessment to close the season. It will be compared with the diagnostic to show the child&apos;s growth.
              </p>
            </div>
          </div>
        </div>

        {/* Child Info */}
        {child && (
          <div className="bg-surface-1 border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#0066CC] flex items-center justify-center text-white font-bold text-sm">
                {child.child_name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{child.child_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-tertiary">{child.age} years</span>
                  <AgeBandBadge ageBand={ageBand} />
                </div>
              </div>
              {session?.duration_minutes && (
                <div className="flex items-center gap-1 text-text-tertiary text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {session.duration_minutes}m
                </div>
              )}
            </div>
          </div>
        )}

        {/* Diagnostic Baseline Reference */}
        {diagnosticBaseline && (
          <div className="bg-surface-1 border border-border rounded-xl mb-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBaseline(!showBaseline)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-white text-sm font-medium">Session 1 Baseline (Reference)</span>
              {showBaseline ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
            </button>
            {showBaseline && (
              <div className="px-4 pb-4 space-y-1">
                {Object.entries(diagnosticBaseline).map(([key, val]) => {
                  if (key === 'coach_observations' || key === 'age_band') return null;
                  const label = SKILL_LABELS[key] || key.replace(/_/g, ' ');
                  const displayVal = Array.isArray(val) ? val.join(', ') : String(val || '—');
                  return (
                    <div key={key} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                      <span className="text-xs text-text-tertiary">{label}</span>
                      <span className="text-xs text-amber-400 font-medium">{displayVal.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Status messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center justify-between">
            <span>{success}</span>
            {seasonResult?.next_season && (
              <span className="text-[#00ABFF] text-xs">
                Next: {seasonResult.next_season.season_name}
              </span>
            )}
          </div>
        )}

        {/* Form — uses DiagnosticForm with exit fields */}
        <DiagnosticForm
          ageBand={ageBand}
          initialData={existingData || undefined}
          onSubmit={handleSubmit}
          saving={saving}
          fields={exitFields}
        />
      </div>
    </div>
  );
}
