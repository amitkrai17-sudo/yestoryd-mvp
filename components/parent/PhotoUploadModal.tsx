'use client';

// ============================================================
// FILE: components/parent/PhotoUploadModal.tsx
// PURPOSE: Standalone photo upload modal for parent portal.
// Handles camera/gallery capture, multi-photo (max 3), upload,
// and Gemini-Vision analysis polling.
//
// Backend: POST /api/parent/artifacts/upload
//          GET  /api/parent/artifacts/{id}/status
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, ImagePlus, Check, X, Plus, AlertCircle, Sparkles,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export interface PhotoUploadModalContext {
  type: 'session_homework' | 'practice' | 'assessment' | 'freeform';
  taskId?: string;
  sessionId?: string;
  enrollmentId?: string;
  title?: string;
  linkedSkill?: string;
}

export interface PhotoUploadArtifactSummary {
  id: string;
  thumbnailUrl: string | null;
}

export interface PhotoUploadAnalysisSummary {
  artifactId: string;
  completeness: string;
  effort_level: string;
  content_summary: string;
  observations: string[];
}

export interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId: string;
  childName: string;
  context: PhotoUploadModalContext;
  onUploadComplete?: (artifact: PhotoUploadArtifactSummary) => void;
  onAnalysisComplete?: (analysis: PhotoUploadAnalysisSummary) => void;
  maxPhotos?: number;
  showAnalysisFeedback?: boolean;
}

type PhotoStatus = 'uploading' | 'analyzing' | 'analyzed' | 'error';

interface PhotoSlot {
  clientId: string;          // local-only id for keying
  localPreview: string;      // object URL for immediate display
  status: PhotoStatus;
  artifactId?: string;       // server-assigned after upload
  thumbnailUrl?: string;     // signed URL returned by upload
  errorMessage?: string;
  analysisFeedback?: string; // content_summary or first observation
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
// Keep in sync with lib/storage/artifact-storage.ts ALLOWED_MIME_TYPES.
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
]);
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 10; // ~30s total

export default function PhotoUploadModal({
  isOpen,
  onClose,
  childId,
  childName,
  context,
  onUploadComplete,
  onAnalysisComplete,
  maxPhotos = 3,
  showAnalysisFeedback = true,
}: PhotoUploadModalProps) {
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [topError, setTopError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // Ref mirrors photos so the close-time cleanup revokes the latest object URLs,
  // not the stale closure captured at mount.
  const photosRef = useRef<PhotoSlot[]>([]);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  useEffect(() => {
    if (!isOpen) {
      photosRef.current.forEach(p => URL.revokeObjectURL(p.localPreview));
      setPhotos([]);
      setTopError(null);
    }
  }, [isOpen]);

  const updatePhoto = useCallback((clientId: string, patch: Partial<PhotoSlot>) => {
    setPhotos(prev => prev.map(p => (p.clientId === clientId ? { ...p, ...patch } : p)));
  }, []);

  const pollAnalysis = useCallback(async (clientId: string, artifactId: string) => {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const res = await fetch(`/api/parent/artifacts/${artifactId}/status`, {
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const data = await res.json();

        if (data.analysis_status === 'completed') {
          const feedback = data.content_summary
            || (Array.isArray(data.observations) && data.observations[0])
            || null;

          updatePhoto(clientId, {
            status: 'analyzed',
            analysisFeedback: feedback || undefined,
          });

          if (onAnalysisComplete) {
            onAnalysisComplete({
              artifactId,
              completeness: data.completeness || 'partial',
              effort_level: data.effort_level || 'moderate',
              content_summary: data.content_summary || '',
              observations: Array.isArray(data.observations) ? data.observations : [],
            });
          }
          return;
        }

        if (data.analysis_status === 'failed') {
          // Keep photo as uploaded but mark analysis unavailable.
          updatePhoto(clientId, { status: 'analyzed', analysisFeedback: undefined });
          return;
        }
        // otherwise still 'pending' or 'processing' — keep polling
      } catch {
        // Network hiccup — try again until attempts exhausted
      }
    }
    // Timed out — leave as 'analyzed' without feedback (upload succeeded, analysis still running).
    updatePhoto(clientId, { status: 'analyzed', analysisFeedback: undefined });
  }, [onAnalysisComplete, updatePhoto]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected if needed
    e.target.value = '';
    if (!file) return;

    setTopError(null);

    if (!ALLOWED_MIME.has(file.type)) {
      setTopError('Unsupported file type. Please use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setTopError(`Photo must be under 5 MB (this one is ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    if (photos.length >= maxPhotos) {
      setTopError(`Maximum ${maxPhotos} photos per upload.`);
      return;
    }

    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localPreview = URL.createObjectURL(file);

    setPhotos(prev => [...prev, {
      clientId,
      localPreview,
      status: 'uploading',
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('childId', childId);
      formData.append('contextType', context.type);
      if (context.taskId) formData.append('taskId', context.taskId);
      if (context.sessionId) formData.append('sessionId', context.sessionId);
      if (context.enrollmentId) formData.append('enrollmentId', context.enrollmentId);
      if (context.linkedSkill) formData.append('linkedSkill', context.linkedSkill);
      if (context.title) formData.append('taskTitle', context.title);

      const res = await fetch('/api/parent/artifacts/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        updatePhoto(clientId, {
          status: 'error',
          errorMessage: data.error || 'Upload failed. Please try again.',
        });
        return;
      }

      const artifactId = data.artifact.id as string;
      const thumbnailUrl = data.artifact.thumbnailUrl as string | null;

      updatePhoto(clientId, {
        status: 'analyzing',
        artifactId,
        thumbnailUrl: thumbnailUrl || undefined,
      });

      onUploadComplete?.({ id: artifactId, thumbnailUrl });

      if (showAnalysisFeedback) {
        // Fire-and-forget poll; component handles its own state updates
        void pollAnalysis(clientId, artifactId);
      } else {
        // Skip polling — mark as analyzed immediately
        updatePhoto(clientId, { status: 'analyzed' });
      }
    } catch (err) {
      updatePhoto(clientId, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Upload failed. Please try again.',
      });
    }
  }, [childId, context, maxPhotos, onUploadComplete, photos.length, pollAnalysis, showAnalysisFeedback, updatePhoto]);

  if (!isOpen) return null;

  const reachedLimit = photos.length >= maxPhotos;
  const anyAnalyzed = photos.some(p => p.status === 'analyzed' && p.analysisFeedback);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Upload photo"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="pr-8">
            <h2 className="text-lg font-semibold text-gray-900">
              {context.title || `Upload ${childName}'s Work`}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {context.type === 'session_homework'
                ? 'Snap the completed homework'
                : context.type === 'practice'
                ? 'Share a photo of their practice'
                : context.type === 'assessment'
                ? 'Capture the assessment work'
                : 'Upload a photo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Top error */}
        {topError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{topError}</p>
          </div>
        )}

        {/* Camera button — primary CTA */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={reachedLimit}
          className={`w-full rounded-xl p-6 text-center transition-colors cursor-pointer mb-3 min-h-[48px]
            ${reachedLimit
              ? 'bg-gray-50 border-2 border-dashed border-gray-200 cursor-not-allowed'
              : 'bg-[#FFF5F9] border-2 border-dashed border-[#FF0099]/40 hover:border-[#FF0099]'}`}
        >
          <Camera className={`h-8 w-8 mx-auto mb-2 ${reachedLimit ? 'text-gray-300' : 'text-[#FF0099]'}`} />
          <p className={`text-sm font-semibold ${reachedLimit ? 'text-gray-400' : 'text-[#FF0099]'}`}>
            Take Photo
          </p>
          <p className={`text-xs mt-0.5 ${reachedLimit ? 'text-gray-400' : 'text-[#FF0099]/70'}`}>
            Open camera
          </p>
        </button>

        {/* Gallery button — secondary */}
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={reachedLimit}
          className={`w-full rounded-xl p-4 flex items-center gap-3 transition-colors min-h-[48px]
            ${reachedLimit
              ? 'bg-gray-50 border border-gray-200 cursor-not-allowed'
              : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}
        >
          <ImagePlus className={`h-5 w-5 ${reachedLimit ? 'text-gray-300' : 'text-gray-600'}`} />
          <span className={`text-sm font-medium ${reachedLimit ? 'text-gray-400' : 'text-gray-800'}`}>
            Choose from Gallery
          </span>
        </button>

        {/* Thumbnail strip */}
        <div className="mt-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Photos ({photos.length}/{maxPhotos})
          </p>
          <div className="flex gap-3">
            {Array.from({ length: maxPhotos }).map((_, idx) => {
              const photo = photos[idx];
              if (!photo) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0"
                  >
                    <Plus className="h-5 w-5 text-gray-300" />
                  </div>
                );
              }

              const borderClass =
                photo.status === 'error' ? 'border-red-400'
                : photo.status === 'analyzed' ? 'border-green-400'
                : photo.status === 'analyzing' ? 'border-amber-300'
                : 'border-[#FF0099]/40';

              return (
                <div
                  key={photo.clientId}
                  className={`w-20 h-20 rounded-lg overflow-hidden relative border-2 ${borderClass} flex-shrink-0`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.localPreview}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {photo.status === 'uploading' && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {photo.status === 'analyzing' && (
                    <div className="absolute inset-0 bg-amber-900/30 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white animate-pulse" />
                    </div>
                  )}
                  {photo.status === 'analyzed' && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {photo.status === 'error' && (
                    <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Per-photo errors */}
          {photos.some(p => p.status === 'error') && (
            <div className="mt-2 space-y-1">
              {photos.filter(p => p.status === 'error').map(p => (
                <p key={p.clientId} className="text-xs text-red-600">
                  {p.errorMessage || 'Upload failed'}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* AI feedback card */}
        {showAnalysisFeedback && anyAnalyzed && (
          <div className="mt-5 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-green-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                  rAI feedback
                </p>
                {photos
                  .filter(p => p.status === 'analyzed' && p.analysisFeedback)
                  .map(p => (
                    <p key={p.clientId} className="text-sm text-green-800 leading-relaxed">
                      {p.analysisFeedback}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Done button */}
        <button
          onClick={onClose}
          className="w-full h-12 rounded-xl bg-[#FF0099] text-white font-medium hover:bg-[#E6008A] transition-colors mt-5"
        >
          Done
        </button>
      </div>
    </div>
  );
}
