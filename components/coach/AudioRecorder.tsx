// components/coach/AudioRecorder.tsx
// Reusable audio recorder for voice notes and reading clips
// Uses MediaRecorder API — mobile-first, large tap targets

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type AudioType = 'voice_note' | 'reading_clip';
type RecorderState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'uploaded';

interface AudioRecorderProps {
  sessionId: string;
  audioType: AudioType;
  onUploadComplete: (storagePath: string) => void;
  maxDurationSeconds?: number;
  promptText?: string;
}

// Check MediaRecorder support and preferred MIME type
function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioRecorder({
  sessionId,
  audioType,
  onUploadComplete,
  maxDurationSeconds = 300, // 5 minutes default
  promptText,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUnsupported(true);
      } else if (!getSupportedMimeType()) {
        setUnsupported(true);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setPermissionDenied(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setUnsupported(true);
        return;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeBase = mimeType.split(';')[0];
        const blob = new Blob(chunksRef.current, { type: mimeBase });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        setState('recorded');

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          if (next >= maxDurationSeconds) {
            mediaRecorder.stop();
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setPermissionDenied(true);
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('Could not start recording. Please try again.');
      }
      console.error('Recording error:', err);
    }
  }, [maxDurationSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reRecord = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    chunksRef.current = [];
    setDuration(0);
    setIsPlaying(false);
    setState('idle');
    setError(null);
  }, []);

  const togglePlayback = useCallback(() => {
    if (!audioUrlRef.current) return;

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrlRef.current);
      audioElementRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const uploadAudio = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    setState('uploading');
    setError(null);
    setUploadProgress(0);

    try {
      const mimeType = getSupportedMimeType() || 'audio/webm';
      const mimeBase = mimeType.split(';')[0];
      const blob = new Blob(chunksRef.current, { type: mimeBase });

      const extMap: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
      };
      const ext = extMap[mimeBase] || 'webm';

      const formData = new FormData();
      formData.append('file', blob, `${audioType}_${Date.now()}.${ext}`);
      formData.append('type', audioType);

      // Simulate progress since fetch doesn't support progress natively
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 90));
      }, 300);

      const response = await fetch(`/api/coach/sessions/${sessionId}/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);
      setState('uploaded');
      onUploadComplete(result.storage_path);
    } catch (err) {
      setState('recorded');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      console.error('Upload error:', err);
    }
  }, [sessionId, audioType, onUploadComplete]);

  // Permission denied state
  if (permissionDenied) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400 text-sm font-medium mb-1">Microphone Access Required</p>
        <p className="text-red-400/70 text-xs">
          Please allow microphone access in your browser settings, then refresh this page.
        </p>
      </div>
    );
  }

  // Unsupported browser
  if (unsupported) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-yellow-400 text-sm font-medium mb-1">Recording Not Supported</p>
        <p className="text-yellow-400/70 text-xs">
          Your browser doesn&apos;t support audio recording. Please use Chrome, Safari, or Firefox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Prompt text */}
      {promptText && state === 'idle' && (
        <p className="text-text-secondary text-xs">{promptText}</p>
      )}

      {/* Main recorder area */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        {/* IDLE state — big record button */}
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="w-full flex flex-col items-center gap-3 py-4"
          >
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <span className="text-text-secondary text-sm">Tap to record</span>
          </button>
        )}

        {/* RECORDING state — pulsing indicator + stop button */}
        {state === 'recording' && (
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Pulsing ring */}
            <div className="relative">
              <div className="absolute inset-0 w-16 h-16 bg-red-500/30 rounded-full animate-ping" />
              <button
                onClick={stopRecording}
                className="relative w-16 h-16 bg-red-500 rounded-full flex items-center justify-center active:scale-95 transition-transform z-10"
              >
                <Square className="w-6 h-6 text-white fill-white" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-sm font-medium font-mono">{formatDuration(duration)}</span>
              <span className="text-text-tertiary text-xs">/ {formatDuration(maxDurationSeconds)}</span>
            </div>
            <span className="text-text-tertiary text-xs">Tap to stop</span>
          </div>
        )}

        {/* RECORDED state — playback + upload controls */}
        {state === 'recorded' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-green-400" />
                <span className="text-white text-sm font-medium">{formatDuration(duration)}</span>
                <span className="text-text-tertiary text-xs">recorded</span>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlayback}
                className="flex-1 flex items-center justify-center gap-2 bg-surface-3 text-white py-3 rounded-lg text-sm font-medium hover:bg-surface-4 active:scale-[0.98] transition-all min-h-[48px]"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              {/* Re-record */}
              <button
                onClick={reRecord}
                className="flex items-center justify-center gap-2 bg-surface-3 text-text-secondary px-4 py-3 rounded-lg text-sm hover:bg-surface-4 active:scale-[0.98] transition-all min-h-[48px]"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Upload */}
              <button
                onClick={uploadAudio}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-lg text-sm font-medium hover:bg-brand-primary/90 active:scale-[0.98] transition-all min-h-[48px]"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>
        )}

        {/* UPLOADING state */}
        {state === 'uploading' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
            <div className="w-full max-w-[200px]">
              <div className="bg-surface-3 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-text-secondary text-sm">Uploading...</span>
          </div>
        )}

        {/* UPLOADED state */}
        {state === 'uploaded' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle className="w-10 h-10 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Uploaded successfully</span>
            <span className="text-text-tertiary text-xs">{formatDuration(duration)} recorded</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}
