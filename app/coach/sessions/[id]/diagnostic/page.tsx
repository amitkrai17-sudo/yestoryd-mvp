'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, ClipboardCheck, ChevronDown, ChevronUp,
  Clock, BookOpen, AlertCircle,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';
import { DiagnosticForm } from '@/components/coach/diagnostic-form';

interface SessionInfo {
  id: string;
  child_id: string;
  coach_id: string;
  session_number: number | null;
  is_diagnostic: boolean;
  status: string;
  duration_minutes: number | null;
}

interface ChildInfo {
  id: string;
  child_name: string;
  age: number;
  age_band: string | null;
}

interface ActivityStep {
  time: string;
  activity: string;
  purpose: string;
}

interface TemplateInfo {
  id: string;
  template_code: string;
  title: string;
  description: string | null;
  activity_flow: ActivityStep[] | null;
  materials_needed: string[] | null;
  coach_prep_notes: string | null;
  parent_involvement: string | null;
  duration_minutes: number;
}

export default function DiagnosticPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [ageBand, setAgeBand] = useState('building');
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [existingData, setExistingData] = useState<Record<string, any> | null>(null);
  const [planChildId, setPlanChildId] = useState<string | null>(null);

  const [showActivityFlow, setShowActivityFlow] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coach/diagnostic/${sessionId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to load session');
          setLoading(false);
          return;
        }

        setSession(data.session);
        setChild(data.child);
        setAgeBand(data.age_band);
        setTemplate(data.template);

        if (data.diagnostic) {
          setExistingData(data.diagnostic.data);
        }
      } catch {
        setError('Failed to load diagnostic data');
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
      const res = await fetch(`/api/coach/diagnostic/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosticData: formData }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      if (data.plan?.roadmap_id) {
        setSuccess(`Diagnostic saved! Learning plan "${data.plan.season_name}" generated with ${data.plan.plan_items} sessions.`);
        setPlanChildId(session?.child_id || null);
      } else {
        setSuccess('Diagnostic assessment saved.');
      }
      setExistingData(formData);
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
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
          <button onClick={() => router.back()} className="text-[#00ABFF] font-medium">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-surface-2 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-text-tertiary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#00ABFF]" />
              Diagnostic Assessment
            </h1>
            <p className="text-xs text-text-tertiary">
              Session {session?.session_number || 1} {child ? `— ${child.child_name}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Diagnostic Banner */}
        <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 text-[#00ABFF] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">Diagnostic Session</p>
              <p className="text-text-tertiary text-xs mt-0.5">
                Complete this assessment after the session. It will be used to generate a personalized learning plan.
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

        {/* Template Activity Flow (collapsible) */}
        {template && template.activity_flow && template.activity_flow.length > 0 && (
          <div className="bg-surface-1 border border-border rounded-xl mb-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowActivityFlow(!showActivityFlow)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00ABFF]" />
                <span className="text-white text-sm font-medium">
                  {template.template_code}: {template.title}
                </span>
              </div>
              {showActivityFlow ? (
                <ChevronUp className="w-4 h-4 text-text-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
            {showActivityFlow && (
              <div className="px-4 pb-4 space-y-3">
                {template.description && (
                  <p className="text-text-tertiary text-xs">{template.description}</p>
                )}

                <div className="space-y-1">
                  <div className="grid grid-cols-[60px_1fr_1fr] gap-2 text-[10px] text-text-tertiary font-medium pb-1 border-b border-border">
                    <span>Time</span>
                    <span>Activity</span>
                    <span>Purpose</span>
                  </div>
                  {template.activity_flow.map((step: ActivityStep, i: number) => (
                    <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 text-xs py-1">
                      <span className="text-[#00ABFF] font-mono">{step.time}</span>
                      <span className="text-white">{step.activity}</span>
                      <span className="text-text-tertiary">{step.purpose}</span>
                    </div>
                  ))}
                </div>

                {template.materials_needed && template.materials_needed.length > 0 && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-1">Materials</p>
                    <div className="flex flex-wrap gap-1">
                      {template.materials_needed.map((m: string) => (
                        <span key={m} className="text-xs px-2 py-0.5 bg-surface-2 rounded-full text-white border border-border">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {template.coach_prep_notes && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-1">Coach Notes</p>
                    <p className="text-xs text-white">{template.coach_prep_notes}</p>
                  </div>
                )}
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
            {planChildId && (
              <button
                onClick={() => router.push(`/coach/children/${planChildId}/plan`)}
                className="text-[#00ABFF] font-medium text-xs whitespace-nowrap ml-3 hover:underline"
              >
                View Plan →
              </button>
            )}
          </div>
        )}

        {/* Diagnostic Form */}
        <DiagnosticForm
          ageBand={ageBand}
          initialData={existingData || undefined}
          onSubmit={handleSubmit}
          saving={saving}
        />
      </div>
    </div>
  );
}
