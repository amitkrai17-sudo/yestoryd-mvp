// ============================================================
// Card 3: Child Artifact — Audio / Text / Photo / None
// ============================================================

'use client';

import { useState, useRef } from 'react';
import { Mic, FileText, Camera, XCircle, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '@/components/coach/AudioRecorder';
import type { CardProps, ArtifactType } from '../types';

interface ChildArtifactCardProps extends CardProps {
  sessionId: string;
}

const ARTIFACT_OPTIONS: { type: ArtifactType; label: string; icon: typeof Mic }[] = [
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'photo', label: 'Photo', icon: Camera },
  { type: 'none', label: 'None', icon: XCircle },
];

export function ChildArtifactCard({ state, onUpdate, sessionId }: ChildArtifactCardProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectType = (type: ArtifactType) => {
    onUpdate({
      artifactType: type,
      // Clear other artifact data when switching
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

    // Preview
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);

    // Store as a reference — actual upload deferred
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

      {/* Audio recorder */}
      {state.artifactType === 'audio' && (
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
