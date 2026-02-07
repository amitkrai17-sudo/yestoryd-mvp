import { useState, useCallback, useRef, useEffect } from 'react';

interface UseTTSOptions {
  age: number;
  fallbackToWebSpeech?: boolean; // Default true
}

interface TTSState {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
}

export function useTTS(options: UseTTSOptions) {
  const { age, fallbackToWebSpeech = true } = options;

  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isPlaying: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map()); // Cache audio URLs

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke cached object URLs
      audioCache.current.forEach((url) => URL.revokeObjectURL(url));
      audioCache.current.clear();
    };
  }, []);

  // Stop current playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel(); // Stop web speech if active
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  // Fallback to Web Speech API
  const speakWithWebSpeech = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) {
        throw new Error('Web Speech API not supported');
      }

      return new Promise<void>((resolve, reject) => {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = age <= 7 ? 0.85 : age <= 10 ? 0.95 : 1.0;
        utterance.pitch = age <= 7 ? 1.2 : 1.0;

        utterance.onend = () => {
          setState((prev) => ({ ...prev, isPlaying: false }));
          resolve();
        };

        utterance.onerror = (event) => {
          setState((prev) => ({ ...prev, isPlaying: false, error: 'Web Speech failed' }));
          reject(new Error(`Web Speech error: ${event.error}`));
        };

        setState((prev) => ({ ...prev, isPlaying: true, error: null }));
        window.speechSynthesis.speak(utterance);
      });
    },
    [age]
  );

  // Main speak function using Google Cloud TTS
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Stop any ongoing playback
      stop();

      // Check cache first
      const cacheKey = `${text}-${age}`;
      let audioUrl = audioCache.current.get(cacheKey);

      try {
        setState({ isLoading: true, isPlaying: false, error: null });

        if (!audioUrl) {
          // Fetch from Google Cloud TTS API
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, age }),
          });

          if (!response.ok) {
            throw new Error(`TTS API error: ${response.status}`);
          }

          const audioBlob = await response.blob();
          audioUrl = URL.createObjectURL(audioBlob);

          // Cache the audio URL
          audioCache.current.set(cacheKey, audioUrl);
        }

        // Play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setState((prev) => ({ ...prev, isPlaying: false }));
          audioRef.current = null;
        };

        audio.onerror = () => {
          setState((prev) => ({ ...prev, isPlaying: false, error: 'Audio playback failed' }));
          audioRef.current = null;
        };

        await audio.play();
        setState({ isLoading: false, isPlaying: true, error: null });
      } catch (error) {
        console.error('TTS Error:', error);

        // Fallback to Web Speech API
        if (fallbackToWebSpeech) {
          try {
            setState((prev) => ({ ...prev, isLoading: false }));
            await speakWithWebSpeech(text);
          } catch (fallbackError) {
            console.error('Web Speech fallback failed:', fallbackError);
            setState({
              isLoading: false,
              isPlaying: false,
              error: 'Speech synthesis failed',
            });
          }
        } else {
          setState({
            isLoading: false,
            isPlaying: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    },
    [age, fallbackToWebSpeech, speakWithWebSpeech, stop]
  );

  return {
    ...state,
    speak,
    stop,
  };
}
