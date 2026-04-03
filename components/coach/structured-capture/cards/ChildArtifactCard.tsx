// ============================================================
// Card 3: Child Artifact — Audio / Text / Photo / None
// With contextual hints based on selected skills
// ============================================================

'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Mic, FileText, Camera, XCircle, ImageIcon, Video, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '@/components/coach/AudioRecorder';
import type { CardProps, ArtifactType, ModuleGroup } from '../types';

interface ChildArtifactCardProps extends CardProps {
  sessionId: string;
  isOnline?: boolean;
  modules?: ModuleGroup[];
}

const ARTIFACT_OPTIONS: { type: ArtifactType; label: string; icon: typeof Mic }[] = [
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'photo', label: 'Photo', icon: Camera },
  { type: 'none', label: 'None', icon: XCircle },
];

// Skill slug → recommended artifact type
// Uses skill_categories slugs from DB, not hardcoded names
type ArtifactRecommendation = 'audio' | 'photo' | 'either' | 'none';

const SLUG_TO_ARTIFACT: Record<string, ArtifactRecommendation> = {
  phonics_letter_sounds: 'audio',
  reading_fluency: 'audio',
  pronunciation: 'audio',
  grammar_syntax: 'photo',
  creative_writing: 'photo',
  vocabulary_building: 'either',
  reading_comprehension: 'none',
  story_analysis: 'none',
};

const SLUG_TO_HINT: Record<string, string> = {
  phonics_letter_sounds: 'Record a 30-second reading clip to track phonics progress',
  reading_fluency: 'Record a short reading clip — helps measure WPM over time',
  pronunciation: 'Record speech to track pronunciation improvement',
  grammar_syntax: 'Photograph written work to track sentence formation',
  creative_writing: 'Photograph writing to track improvement',
  vocabulary_building: 'Record word usage or photograph vocabulary exercises',
  reading_comprehension: 'Coach observations are sufficient for comprehension',
  story_analysis: 'Coach observations are sufficient for analysis',
};

function getArtifactRecommendation(
  selectedSkillIds: string[],
  modules: ModuleGroup[]
): { type: ArtifactRecommendation; hint: string } {
  // Find which category slugs are represented by selected skills
  const selectedSlugs = new Set<string>();
  for (const skillId of selectedSkillIds) {
    for (const { module, skills } of modules) {
      if (skills.some(s => s.id === skillId) && module.slug) {
        selectedSlugs.add(module.slug);
      }
    }
  }

  if (selectedSlugs.size === 0) return { type: 'none', hint: '' };

  // Collect recommendations and hints
  const recs: ArtifactRecommendation[] = [];
  const hints: string[] = [];

  for (const slug of Array.from(selectedSlugs)) {
    const rec = SLUG_TO_ARTIFACT[slug];
    if (rec) recs.push(rec);
    const hint = SLUG_TO_HINT[slug];
    if (hint) hints.push(hint);
  }

  // Determine primary recommendation
  const hasAudio = recs.includes('audio');
  const hasPhoto = recs.includes('photo');
  const hasEither = recs.includes('either');

  let type: ArtifactRecommendation;
  let hint: string;

  if (hasAudio && hasPhoto) {
    type = 'either';
    hint = 'Consider a reading clip or a photo of written work';
  } else if (hasAudio) {
    type = 'audio';
    hint = hints.find(h => h.includes('Record')) || hints[0] || '';
  } else if (hasPhoto) {
    type = 'photo';
    hint = hints.find(h => h.includes('Photograph')) || hints[0] || '';
  } else if (hasEither) {
    type = 'either';
    hint = hints[0] || '';
  } else {
    type = 'none';
    hint = hints[0] || 'No artifact needed — coach observations are sufficient';
  }

  return { type, hint };
}

export function ChildArtifactCard({ state, onUpdate, sessionId, isOnline, modules }: ChildArtifactCardProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const recommendation = useMemo(
    () => getArtifactRecommendation(state.selectedSkillIds, modules || []),
    [state.selectedSkillIds, modules]
  );

  // Pre-select artifact type based on skills (once, on mount)
  useEffect(() => {
    if (hasAutoSelected || state.artifactType !== 'none') return;
    if (recommendation.type === 'audio' && !isOnline) {
      onUpdate({ artifactType: 'audio' });
      setHasAutoSelected(true);
    } else if (recommendation.type === 'photo') {
      onUpdate({ artifactType: 'photo' });
      setHasAutoSelected(true);
    }
  }, [recommendation.type, isOnline, hasAutoSelected, state.artifactType, onUpdate]);

  const selectType = (type: ArtifactType) => {
    onUpdate({
      artifactType: type,
      ...(type !== 'audio' && { artifactUrl: state.artifactType === 'audio' ? '' : state.artifactUrl }),
      ...(type !== 'text' && { artifactText: '' }),
    });
    if (type !== 'photo') {
      setPhotoPreview(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    onUpdate({ artifactUrl: `pending:${file.name}` });
  };

  const handleAudioUpload = (storagePath: string) => {
    onUpdate({ artifactUrl: storagePath });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Child Artifact</h3>
        <p className="text-text-tertiary text-xs">
          Optionally capture a reading sample or work artifact
        </p>
      </div>

      {/* Contextual hint based on selected skills */}
      {recommendation.hint && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-xl p-3 border',
          recommendation.type === 'audio' ? 'bg-pink-500/5 border-pink-500/20' :
          recommendation.type === 'photo' ? 'bg-blue-500/5 border-blue-500/20' :
          recommendation.type === 'either' ? 'bg-purple-500/5 border-purple-500/20' :
          'bg-surface-2 border-border'
        )}>
          <Lightbulb className={cn(
            'w-4 h-4 flex-shrink-0 mt-0.5',
            recommendation.type === 'audio' ? 'text-pink-400' :
            recommendation.type === 'photo' ? 'text-blue-400' :
            recommendation.type === 'either' ? 'text-purple-400' :
            'text-text-tertiary'
          )} />
          <p className={cn(
            'text-xs',
            recommendation.type === 'none' ? 'text-text-tertiary' : 'text-text-secondary'
          )}>
            {recommendation.hint}
          </p>
        </div>
      )}

      {/* Type selector */}
      <div className="grid grid-cols-4 gap-2">
        {ARTIFACT_OPTIONS.map(({ type, label, icon: Icon }) => {
          const selected = state.artifactType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all min-h-[44px]',
                'active:scale-95',
                selected
                  ? 'bg-[#00ABFF]/20 text-[#00ABFF] border-[#00ABFF]/40'
                  : 'bg-surface-2 text-text-tertiary border-border hover:border-text-tertiary',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Audio: online → Recall.ai info, offline → record + upload */}
      {state.artifactType === 'audio' && isOnline && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00ABFF]/20 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-[#00ABFF]" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Audio captured automatically</p>
            <p className="text-text-tertiary text-xs mt-1">
              Recall.ai records online sessions automatically. No manual recording needed.
              Use Text or Photo to capture additional artifacts.
            </p>
          </div>
        </div>
      )}
      {state.artifactType === 'audio' && !isOnline && (
        <AudioRecorder
          sessionId={sessionId === 'new' ? 'capture-' + Date.now() : sessionId}
          audioType="reading_clip"
          onUploadComplete={handleAudioUpload}
          maxDurationSeconds={120}
          promptText="Record a reading sample from the child"
        />
      )}

      {/* Text input */}
      {state.artifactType === 'text' && (
        <textarea
          value={state.artifactText}
          onChange={e => onUpdate({ artifactText: e.target.value })}
          placeholder="Type or paste the child's written work..."
          rows={4}
          className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
        />
      )}

      {/* Photo capture */}
      {state.artifactType === 'photo' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {photoPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Artifact preview"
                className="w-full rounded-xl border border-border max-h-48 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null);
                  onUpdate({ artifactUrl: '' });
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-8 bg-surface-2 border border-dashed border-border rounded-xl hover:border-text-tertiary transition-colors"
            >
              <ImageIcon className="w-8 h-8 text-text-tertiary" />
              <span className="text-text-tertiary text-sm">Tap to take or select a photo</span>
            </button>
          )}
        </div>
      )}

      {/* None selected */}
      {state.artifactType === 'none' && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 text-center">
          <p className="text-text-tertiary text-sm">No artifact for this session — that&apos;s okay!</p>
        </div>
      )}
    </div>
  );
}
