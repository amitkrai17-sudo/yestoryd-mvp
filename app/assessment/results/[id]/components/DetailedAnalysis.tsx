'use client';

import { Target, Volume2, AlertCircle, Sparkles, Lightbulb, FileText, BookOpen } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { SkillBar } from './SkillBar';

interface SkillScore {
  score: number;
  notes: string;
}

interface DetailedAnalysisProps {
  skillBreakdown?: Record<string, SkillScore>;
  phonicsAnalysis?: {
    recommended_focus?: string;
    struggling_phonemes?: string[];
    strong_phonemes?: string[];
  };
  errorClassification?: {
    substitutions?: Array<{ original: string; read_as: string }>;
    omissions?: string[];
    mispronunciations?: Array<{ word: string; issue: string }>;
  };
  practiceRecommendations?: {
    daily_words?: string[];
    phonics_focus?: string;
    suggested_activity?: string;
  };
}

export function DetailedAnalysis({
  skillBreakdown,
  phonicsAnalysis,
  errorClassification,
  practiceRecommendations,
}: DetailedAnalysisProps) {
  const totalErrors = errorClassification
    ? (errorClassification.substitutions?.length || 0) +
      (errorClassification.omissions?.length || 0) +
      (errorClassification.mispronunciations?.length || 0)
    : 0;

  if (!skillBreakdown && !phonicsAnalysis && !errorClassification && !practiceRecommendations) {
    return null;
  }

  return (
    <div className="space-y-3 print:hidden">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Target className="w-5 h-5 text-[#FF0099]" /> Detailed Analysis
      </h3>

      {/* Reading Skills */}
      {skillBreakdown && (
        <CollapsibleSection title="Reading Skills" icon={<Target className="w-5 h-5" />} defaultOpen>
          <div className="pt-4">
            {Object.entries(skillBreakdown).map(([skill, data]) => (
              <SkillBar key={skill} skill={skill} data={data} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Phonics Analysis */}
      {phonicsAnalysis && (
        <CollapsibleSection
          title="Phonics Analysis"
          icon={<Volume2 className="w-5 h-5" />}
          badge={phonicsAnalysis.struggling_phonemes?.length ? `${phonicsAnalysis.struggling_phonemes.length} to improve` : undefined}
          defaultOpen
        >
          <div className="pt-4 space-y-4">
            {phonicsAnalysis.recommended_focus && (
              <div className="bg-[#FF0099]/10 border border-[#FF0099]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-[#FF0099]" />
                  <span className="text-[#FF0099] font-semibold text-sm">Focus Area</span>
                </div>
                <p className="text-white text-sm break-words">{phonicsAnalysis.recommended_focus}</p>
              </div>
            )}
            {phonicsAnalysis.struggling_phonemes && phonicsAnalysis.struggling_phonemes.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">Needs Practice</p>
                <div className="flex flex-wrap gap-2">
                  {phonicsAnalysis.struggling_phonemes.map((p, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1.5 bg-red-500/20 text-red-400 text-sm border border-red-500/30"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {phonicsAnalysis.strong_phonemes && phonicsAnalysis.strong_phonemes.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">Strong</p>
                <div className="flex flex-wrap gap-2">
                  {phonicsAnalysis.strong_phonemes.map((p, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1.5 bg-green-500/20 text-green-400 text-sm border border-green-500/30"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Reading Errors */}
      {errorClassification && totalErrors > 0 && (
        <CollapsibleSection
          title="Reading Errors"
          icon={<AlertCircle className="w-5 h-5" />}
          badge={`${totalErrors} errors`}
        >
          <div className="pt-4 space-y-4">
            {errorClassification.substitutions && errorClassification.substitutions.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase mb-2">Substitutions</p>
                <div className="space-y-2">
                  {errorClassification.substitutions.map((s, i) => (
                    <div key={i} className="rounded-xl bg-surface-2 border border-border px-4 py-2 text-sm">
                      <span className="text-red-400 line-through">{s.original}</span>
                      <span className="text-text-tertiary mx-2">→</span>
                      <span className="text-[#00ABFF]">{s.read_as}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {errorClassification.omissions && errorClassification.omissions.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase mb-2">Skipped Words</p>
                <div className="flex flex-wrap gap-2">
                  {errorClassification.omissions.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1.5 bg-orange-500/20 text-orange-400 text-sm border border-orange-500/30"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {errorClassification.mispronunciations && errorClassification.mispronunciations.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase mb-2">Mispronunciations</p>
                <div className="space-y-2">
                  {errorClassification.mispronunciations.map((m, i) => (
                    <div key={i} className="rounded-xl bg-surface-2 border border-border px-4 py-2 text-sm">
                      <span className="text-[#7B008B] font-medium">{m.word}:</span>{' '}
                      <span className="text-text-secondary break-words">{m.issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Practice Recommendations */}
      {practiceRecommendations && (
        <CollapsibleSection title="Practice at Home" icon={<Sparkles className="w-5 h-5" />} defaultOpen>
          <div className="pt-4 space-y-4">
            {practiceRecommendations.daily_words && practiceRecommendations.daily_words.length > 0 && (
              <div>
                <p className="text-text-tertiary text-xs uppercase mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Daily Words
                </p>
                <div className="flex flex-wrap gap-2">
                  {practiceRecommendations.daily_words.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1.5 bg-[#00ABFF]/20 text-[#00ABFF] text-sm font-medium border border-[#00ABFF]/30"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {practiceRecommendations.phonics_focus && (
              <div className="bg-[#7B008B]/20 border border-[#7B008B]/30 rounded-xl p-4">
                <p className="text-[#c847f4] font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Phonics Focus
                </p>
                <p className="text-white text-sm break-words">{practiceRecommendations.phonics_focus}</p>
              </div>
            )}
            {practiceRecommendations.suggested_activity && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4">
                <p className="text-green-400 font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Activity
                </p>
                <p className="text-white text-sm break-words">{practiceRecommendations.suggested_activity}</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
