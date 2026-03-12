'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, FileText, Upload, CheckCircle, AlertTriangle, X, ImageIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface PendingAssignment {
  id: string;
  topic: string;
  description: string;
  due_date: string;
}

interface ArtifactUploadCardProps {
  childId: string;
  childName: string;
  pendingAssignments?: PendingAssignment[];
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'success' | 'error';
type InputMode = null | 'camera' | 'text';

export default function ArtifactUploadCard({
  childId,
  childName,
  pendingAssignments = [],
  onUploadComplete,
}: ArtifactUploadCardProps) {
  const [mode, setMode] = useState<InputMode>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<PendingAssignment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setMode(null);
    setUploadState('idle');
    setFeedbackText(null);
    setErrorText(null);
    setTypedText('');
    setPhotoPreview(null);
    setSelectedFile(null);
    setSelectedAssignment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadFile = async () => {
    if (!selectedFile) return;
    setUploadState('uploading');
    setErrorText(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('child_id', childId);
      formData.append('source_type', selectedAssignment ? 'coaching_homework' : 'self_initiated');
      if (selectedAssignment) {
        formData.append('assignment_description', selectedAssignment.description || selectedAssignment.topic);
        formData.append('title', selectedAssignment.topic);
      }

      const res = await fetch('/api/artifacts/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadState('error');
        setErrorText(data.error || 'Upload failed');
        return;
      }

      setUploadState('analyzing');

      // Poll for analysis completion
      pollForResult(data.artifact_id);
    } catch {
      setUploadState('error');
      setErrorText('Network error. Please try again.');
    }
  };

  const submitText = async () => {
    if (!typedText.trim()) return;
    setUploadState('uploading');
    setErrorText(null);

    try {
      const formData = new FormData();
      formData.append('typed_text', typedText.trim());
      formData.append('child_id', childId);
      formData.append('source_type', selectedAssignment ? 'coaching_homework' : 'self_initiated');
      if (selectedAssignment) {
        formData.append('assignment_description', selectedAssignment.description || selectedAssignment.topic);
        formData.append('title', selectedAssignment.topic);
      }

      const res = await fetch('/api/artifacts/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadState('error');
        setErrorText(data.error || 'Upload failed');
        return;
      }

      setUploadState('analyzing');
      pollForResult(data.artifact_id);
    } catch {
      setUploadState('error');
      setErrorText('Network error. Please try again.');
    }
  };

  const pollForResult = async (artifactId: string) => {
    let attempts = 0;
    const maxAttempts = 20; // 20 × 3s = 60s max

    const check = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/artifacts/${childId}/${artifactId}`);
        const data = await res.json();

        if (data.artifact?.analysis_status === 'completed') {
          const feedback = data.artifact.analysis?.child_feedback || 'Great work!';
          setFeedbackText(feedback);
          setUploadState('success');
          onUploadComplete?.();
          return;
        }

        if (data.artifact?.analysis_status === 'failed' || data.artifact?.analysis_status === 'unreadable') {
          setUploadState('error');
          setErrorText(
            data.artifact.analysis_status === 'unreadable'
              ? 'The photo was too blurry. Please try again with better lighting.'
              : 'Analysis failed. Your upload is saved — we\'ll retry automatically.',
          );
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 3000);
        } else {
          setUploadState('success');
          setFeedbackText('Upload saved! Analysis will be ready soon.');
          onUploadComplete?.();
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(check, 3000);
        }
      }
    };

    setTimeout(check, 3000);
  };

  // Success state
  if (uploadState === 'success' && feedbackText) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">Great job, {childName}!</h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{feedbackText}</p>
          </div>
        </div>
        <button
          onClick={resetState}
          className="mt-4 w-full h-10 bg-pink-50 text-[#FF0099] rounded-xl text-sm font-medium hover:bg-pink-100 transition-colors"
        >
          Upload Another
        </button>
      </div>
    );
  }

  // Uploading / Analyzing state
  if (uploadState === 'uploading' || uploadState === 'analyzing') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-gray-700">
            {uploadState === 'uploading' ? 'Uploading...' : 'Analyzing work...'}
          </p>
          <p className="text-xs text-gray-400">This usually takes 10-15 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
          <Upload className="w-5 h-5 text-[#FF0099]" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Upload {childName}&apos;s Work</h3>
          <p className="text-xs text-gray-500">Photos of writing, drawings, or typed responses</p>
        </div>
      </div>

      {/* Pending assignments */}
      {pendingAssignments.length > 0 && !mode && (
        <div className="space-y-2">
          {pendingAssignments.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAssignment(a)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all min-h-[44px] ${
                selectedAssignment?.id === a.id
                  ? 'bg-[#FF0099]/5 border-[#FF0099]/30 ring-1 ring-[#FF0099]/20'
                  : 'bg-amber-50 border-amber-200 hover:border-amber-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{a.topic}</p>
              {a.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.description}</p>
              )}
              <p className="text-[10px] text-amber-600 mt-1">
                Due: {new Date(a.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Error state */}
      {uploadState === 'error' && errorText && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700">{errorText}</p>
            <button onClick={() => setUploadState('idle')} className="text-xs text-red-500 underline mt-1">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Mode selector — shown when no mode selected */}
      {!mode && uploadState === 'idle' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setMode('camera');
              // Slight delay so the input is rendered
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
            className="flex flex-col items-center gap-2 py-5 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#FF0099]/30 hover:bg-pink-50/50 transition-all active:scale-[0.98] min-h-[88px]"
          >
            <Camera className="w-6 h-6 text-[#FF0099]" />
            <span className="text-sm font-medium text-gray-700">Upload Photo</span>
          </button>
          <button
            onClick={() => setMode('text')}
            className="flex flex-col items-center gap-2 py-5 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#FF0099]/30 hover:bg-pink-50/50 transition-all active:scale-[0.98] min-h-[88px]"
          >
            <FileText className="w-6 h-6 text-[#FF0099]" />
            <span className="text-sm font-medium text-gray-700">Write Response</span>
          </button>
        </div>
      )}

      {/* Camera / File mode */}
      {mode === 'camera' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {photoPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full rounded-xl border border-gray-200 max-h-52 object-cover"
              />
              <button
                onClick={() => {
                  setPhotoPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-10 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#FF0099]/30 transition-colors"
            >
              <ImageIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">Tap to take or select a photo</span>
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setMode(null); setPhotoPreview(null); setSelectedFile(null); }}
              className="flex-1 h-10 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={uploadFile}
              disabled={!selectedFile}
              className="flex-1 h-10 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#E0007F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Text mode */}
      {mode === 'text' && (
        <div className="space-y-3">
          <textarea
            value={typedText}
            onChange={e => setTypedText(e.target.value)}
            placeholder={`Type ${childName}'s writing here...`}
            rows={4}
            maxLength={10000}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099]/50 resize-none"
          />
          <p className="text-[11px] text-gray-400 text-right">{typedText.length}/10,000</p>

          <div className="flex gap-2">
            <button
              onClick={() => { setMode(null); setTypedText(''); }}
              className="flex-1 h-10 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitText}
              disabled={!typedText.trim()}
              className="flex-1 h-10 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#E0007F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
