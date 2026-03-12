// =============================================================================
// HOOK: useAudioQualityAnalyzer
// Real-time audio quality analysis during recording using Web Audio API.
// Measures RMS volume, duration, and silence ratio to give quality feedback.
// =============================================================================

'use client';

import { useRef, useState, useCallback } from 'react';

// --- Types ---

export type QualityRating = 'good' | 'fair' | 'poor';

export interface AudioQualityMetrics {
  /** Current instantaneous volume level 0–1 (for meter display) */
  volumeLevel: number;
  /** Running average RMS volume across the recording */
  avgRms: number;
  /** Ratio of silent frames to total frames (0–1) */
  silenceRatio: number;
  /** Duration in seconds since analysis started */
  durationSeconds: number;
  /** Overall quality rating derived from metrics */
  qualityRating: QualityRating;
  /** Whether the analyzer is currently running */
  isAnalyzing: boolean;
}

export interface AudioQualityThresholds {
  /** Minimum recording duration in seconds to be considered adequate */
  minDurationSeconds: number;
  /** Minimum average RMS to be considered audible (0–1 scale) */
  minVolumeRms: number;
  /** Maximum silence ratio before quality degrades (0–1) */
  maxSilenceRatio: number;
}

export interface AudioQualityWarning {
  type: 'too_quiet' | 'too_short' | 'too_much_silence';
  message: string;
}

// --- Defaults ---

const DEFAULT_THRESHOLDS: AudioQualityThresholds = {
  minDurationSeconds: 15,
  minVolumeRms: 0.02,
  maxSilenceRatio: 0.7,
};

/** RMS below this value counts as a "silent" frame */
const SILENCE_RMS_THRESHOLD = 0.01;

/** How often (ms) to sample the analyser node */
const SAMPLE_INTERVAL_MS = 100;

// --- Hook ---

export function useAudioQualityAnalyzer(
  thresholds: Partial<AudioQualityThresholds> = {},
) {
  const config: AudioQualityThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const [metrics, setMetrics] = useState<AudioQualityMetrics>({
    volumeLevel: 0,
    avgRms: 0,
    silenceRatio: 0,
    durationSeconds: 0,
    qualityRating: 'good',
    isAnalyzing: false,
  });

  // Internals stored in refs so the sampling loop doesn't depend on state
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const rmsSumRef = useRef<number>(0);
  const sampleCountRef = useRef<number>(0);
  const silentCountRef = useRef<number>(0);

  /**
   * Start analysing a MediaStream (call after getUserMedia).
   * Safe to call multiple times — stops the previous analysis first.
   */
  const startAnalysis = useCallback((stream: MediaStream) => {
    // Clean up any existing analysis
    stopAnalysisInternal();

    try {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Do NOT connect analyser to destination — we don't want to play back

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      startTimeRef.current = Date.now();
      rmsSumRef.current = 0;
      sampleCountRef.current = 0;
      silentCountRef.current = 0;

      const dataArray = new Float32Array(analyser.fftSize);

      intervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Compute RMS of this frame
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Update running totals
        rmsSumRef.current += rms;
        sampleCountRef.current += 1;
        if (rms < SILENCE_RMS_THRESHOLD) {
          silentCountRef.current += 1;
        }

        const count = sampleCountRef.current;
        const avgRms = rmsSumRef.current / count;
        const silenceRatio = silentCountRef.current / count;
        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;

        // Normalise RMS to a 0–1 volume level for the meter (clamped)
        // Typical speech RMS is 0.02–0.15; map so 0.1 ≈ full bar
        const volumeLevel = Math.min(1, rms / 0.1);

        const qualityRating = computeRating(
          avgRms,
          silenceRatio,
          durationSeconds,
          config,
        );

        setMetrics({
          volumeLevel,
          avgRms,
          silenceRatio,
          durationSeconds,
          qualityRating,
          isAnalyzing: true,
        });
      }, SAMPLE_INTERVAL_MS);

      setMetrics(prev => ({ ...prev, isAnalyzing: true }));
    } catch (err) {
      console.error('AudioQualityAnalyzer: failed to start', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Internal cleanup (does not update state) */
  function stopAnalysisInternal() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }

  /**
   * Stop analysis and return final metrics snapshot.
   */
  const stopAnalysis = useCallback((): AudioQualityMetrics => {
    stopAnalysisInternal();

    const count = sampleCountRef.current || 1;
    const avgRms = rmsSumRef.current / count;
    const silenceRatio = silentCountRef.current / count;
    const durationSeconds = startTimeRef.current
      ? (Date.now() - startTimeRef.current) / 1000
      : 0;

    const qualityRating = computeRating(avgRms, silenceRatio, durationSeconds, config);

    const finalMetrics: AudioQualityMetrics = {
      volumeLevel: 0,
      avgRms,
      silenceRatio,
      durationSeconds,
      qualityRating,
      isAnalyzing: false,
    };

    setMetrics(finalMetrics);
    return finalMetrics;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Derive user-facing warnings from final metrics.
   */
  const getWarnings = useCallback(
    (m: AudioQualityMetrics): AudioQualityWarning[] => {
      const warnings: AudioQualityWarning[] = [];

      if (m.durationSeconds < config.minDurationSeconds) {
        warnings.push({
          type: 'too_short',
          message: `Recording is only ${Math.round(m.durationSeconds)}s — we recommend at least ${config.minDurationSeconds}s for an accurate assessment.`,
        });
      }
      if (m.avgRms < config.minVolumeRms) {
        warnings.push({
          type: 'too_quiet',
          message:
            'The recording volume is very low. Try moving the phone closer or asking your child to read a bit louder.',
        });
      }
      if (m.silenceRatio > config.maxSilenceRatio) {
        warnings.push({
          type: 'too_much_silence',
          message:
            'Most of the recording is silence. Make sure your child is reading aloud throughout.',
        });
      }
      return warnings;
    },
    [config.minDurationSeconds, config.minVolumeRms, config.maxSilenceRatio],
  );

  return {
    metrics,
    startAnalysis,
    stopAnalysis,
    getWarnings,
  };
}

// --- Helpers ---

function computeRating(
  avgRms: number,
  silenceRatio: number,
  durationSeconds: number,
  config: AudioQualityThresholds,
): QualityRating {
  let issues = 0;
  if (avgRms < config.minVolumeRms) issues++;
  if (silenceRatio > config.maxSilenceRatio) issues++;
  if (durationSeconds < config.minDurationSeconds) issues++;

  if (issues >= 2) return 'poor';
  if (issues === 1) return 'fair';
  return 'good';
}
