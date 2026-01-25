'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, RotateCcw } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob | null) => void;
  maxDuration?: number; // in seconds
}

export function AudioRecorder({ 
  onRecordingComplete, 
  maxDuration = 180 // 3 minutes default
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        if (prev >= maxDuration) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [maxDuration]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get supported audio mimeType with fallbacks for cross-browser compatibility
  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;

      // Configure MediaRecorder with explicit bitrate for reliable Gemini analysis
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000, // 128kbps for reliable transcription
      };

      if (mimeType) {
        options.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      // Log settings for debugging
      console.log('[AudioRecorder] Using mimeType:', mediaRecorder.mimeType);
      console.log('[AudioRecorder] audioBitsPerSecond:', 128000);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the actual mimeType from the recorder for the blob
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        onRecordingComplete(blob);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);
      startTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please ensure you have granted permission.');
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  }, [isRecording, stopTimer]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  };

  const deleteRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setDuration(0);
    setIsPlaying(false);
    onRecordingComplete(null);
    chunksRef.current = [];
  };

  const retakeRecording = () => {
    deleteRecording();
    startRecording();
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      {!audioURL && (
        <div className="flex flex-col items-center gap-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="xl"
              className="flex items-center gap-3 bg-red-500 hover:bg-red-600"
            >
              <Mic className="w-6 h-6" />
              Start Recording
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* Timer */}
              <div className="text-4xl font-mono font-bold text-red-600">
                {formatTime(duration)}
              </div>
              
              {/* Recording indicator */}
              <div className="flex items-center gap-2 text-red-600">
                <div className={`w-3 h-3 bg-red-600 rounded-full ${!isPaused ? 'animate-pulse' : ''}`} />
                {isPaused ? 'Paused' : 'Recording...'}
              </div>

              {/* Control buttons */}
              <div className="flex gap-3">
                {!isPaused ? (
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Pause className="w-5 h-5" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    onClick={resumeRecording}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Resume
                  </Button>
                )}
                
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop
                </Button>
              </div>
            </div>
          )}

          {/* Recording tips */}
          {!isRecording && (
            <div className="text-sm text-gray-500 text-center max-w-md">
              <p>💡 Tips for a good recording:</p>
              <ul className="mt-2 text-left list-disc list-inside">
                <li>Find a quiet space</li>
                <li>Hold the device steady</li>
                <li>Speak clearly and at a natural pace</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Playback Controls */}
      {audioURL && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Button
              onClick={togglePlayback}
              variant="outline"
              size="icon"
              className="flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>
            
            <audio
              ref={audioRef}
              src={audioURL}
              className="flex-1"
              controls
              onEnded={() => setIsPlaying(false)}
            />
            
            <Button
              onClick={deleteRecording}
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Recording ready ({formatTime(duration)})
            </div>
            
            <Button
              onClick={retakeRecording}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retake
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
