// ============================================================
// FILE: components/coach/SkillBoosterSection.tsx
// PURPOSE: Skill Booster session recommendation section for coach
// ============================================================

'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Zap, Plus, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SkillBoosterSectionProps {
  childId: string;
  childName: string;
  enrollmentId: string;
  coachId: string;
  skillBoosterUsed: number;
  skillBoosterMax: number;
  onSuccess?: () => void;
}

const FOCUS_AREA_OPTIONS = [
  { value: 'phonics_sounds', label: 'Phonics & Letter Sounds' },
  { value: 'reading_fluency', label: 'Reading Fluency' },
  { value: 'comprehension', label: 'Reading Comprehension' },
  { value: 'vocabulary', label: 'Vocabulary Building' },
  { value: 'grammar', label: 'Grammar & Sentence Structure' },
  { value: 'confidence', label: 'Speaking Confidence' },
  { value: 'specific_sounds', label: 'Specific Sound Practice (th, sh, etc.)' },
  { value: 'other', label: 'Other (specify in notes)' },
];

export default function SkillBoosterSection({
  childId,
  childName,
  enrollmentId,
  coachId,
  skillBoosterUsed,
  skillBoosterMax,
  onSuccess
}: SkillBoosterSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [focusArea, setFocusArea] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const remaining = skillBoosterMax - skillBoosterUsed;
  const canRecommend = remaining > 0;

  const handleRecommend = async () => {
    if (!focusArea.trim()) {
      setError('Please select a focus area');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('Please log in again');
        return;
      }

      const response = await fetch('/api/skill-booster/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          childId,
          enrollmentId,
          focusArea,
          coachNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to recommend');
      }

      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setFocusArea('');
        setCoachNotes('');
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to recommend Skill Booster session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setFocusArea('');
    setCoachNotes('');
  };

  return (
    <>
      {/* Skill Booster Section Card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Skill Booster Sessions
          </h3>
          <span className="text-sm text-gray-400">
            {skillBoosterUsed}/{skillBoosterMax} used
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
          <div
            className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] h-2 rounded-full transition-all duration-300"
            style={{ width: `${(skillBoosterUsed / skillBoosterMax) * 100}%` }}
          />
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Recommend an extra 45-min session if {childName} needs additional support.
          Included in the program at no extra cost.
        </p>

        {canRecommend ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#FF0099] to-[#7B008B]
                       text-white font-medium rounded-xl hover:opacity-90 transition-opacity
                       flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Recommend Skill Booster ({remaining} remaining)
          </button>
        ) : (
          <div className="text-center py-3 px-4 bg-gray-700 rounded-xl text-gray-400">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            Maximum Skill Booster sessions used for this enrollment
          </div>
        )}
      </div>

      {/* Recommendation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-4 py-8">
            <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 my-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Recommend Skill Booster
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {success ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Session Recommended!</h4>
                    <p className="text-gray-400">Parent will be notified to book a slot.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Child Name Display */}
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                      <p className="text-sm text-gray-400">Recommending for</p>
                      <p className="text-lg font-semibold text-white">{childName}</p>
                    </div>

                    {/* Focus Area */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        What should this session focus on? <span className="text-[#FF0099]">*</span>
                      </label>
                      <select
                        value={focusArea}
                        onChange={(e) => setFocusArea(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl
                                 text-white focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50
                                 focus:outline-none"
                      >
                        <option value="">Select focus area...</option>
                        {FOCUS_AREA_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Coach Notes */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Notes for session planning (optional)
                      </label>
                      <textarea
                        value={coachNotes}
                        onChange={(e) => setCoachNotes(e.target.value)}
                        placeholder="E.g., 'Struggling with th/sh distinction, needs focused practice with minimal pairs'"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl
                                 text-white placeholder-gray-500
                                 focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50
                                 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Parent Message Preview */}
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-2">📱 Parent will see:</p>
                      <p className="text-sm text-gray-300">
                        "Your coach recommends a Skill Booster session for {childName} focusing on{' '}
                        <strong className="text-white">
                          {focusArea ? FOCUS_AREA_OPTIONS.find(o => o.value === focusArea)?.label : '[focus area]'}
                        </strong>.
                        This session is included in your program at no extra cost."
                      </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={closeModal}
                        className="h-12 px-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRecommend}
                        disabled={!focusArea || isSubmitting}
                        className="h-12 px-4 bg-gradient-to-r from-[#FF0099] to-[#7B008B]
                                 text-white rounded-xl hover:opacity-90 disabled:opacity-50
                                 transition-opacity flex items-center justify-center gap-2 font-medium whitespace-nowrap"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-5 h-5 flex-shrink-0" />
                            <span>Recommend</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
