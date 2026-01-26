'use client';

import { Mic, Square, Play, Pause, RotateCcw, Send, Loader2 } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isPlaying: boolean;
  isAnalyzing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayPause: () => void;
  onRetake: () => void;
  onSubmit: () => void;
  colors: { pink: string; purple: string };
}

export function RecordingControls({
  isRecording,
  recordingTime,
  audioBlob,
  audioUrl,
  isPlaying,
  isAnalyzing,
  onStartRecording,
  onStopRecording,
  onPlayPause,
  onRetake,
  onSubmit,
  colors,
}: RecordingControlsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Not recording, no audio recorded yet
  if (!audioBlob && !isRecording) {
    return (
      <div className="text-center space-y-4">
        <button
          onClick={onStartRecording}
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          style={{ background: `linear-gradient(135deg, ${colors.pink}, ${colors.purple})` }}
        >
          <Mic className="w-8 h-8" />
        </button>
        <p className="text-gray-500 text-sm">Tap to start recording</p>
      </div>
    );
  }

  // Currently recording
  if (isRecording) {
    return (
      <div className="text-center space-y-4">
        {/* Pulsing mic indicator */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-red-500" />
          <div className="absolute inset-2 rounded-full animate-pulse opacity-40 bg-red-500" />
          <button
            onClick={onStopRecording}
            className="relative w-24 h-24 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-500/50"
          >
            <Square className="w-8 h-8" />
          </button>
        </div>

        {/* Timer */}
        <p className="text-3xl font-mono text-gray-900">{formatTime(recordingTime)}</p>
        <p className="text-red-500 text-sm font-medium">Recording... Tap to stop</p>
      </div>
    );
  }

  // Recording complete, show playback and submit
  return (
    <div className="space-y-4">
      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onPlayPause}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </button>

        <div className="text-center">
          <p className="text-2xl font-mono text-gray-900">{formatTime(recordingTime)}</p>
          <p className="text-green-600 text-sm font-medium">Recording complete</p>
        </div>

        <button
          onClick={onRetake}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={isAnalyzing}
        className="w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${colors.pink}, ${colors.purple})` }}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Get Results
          </>
        )}
      </button>
    </div>
  );
}
