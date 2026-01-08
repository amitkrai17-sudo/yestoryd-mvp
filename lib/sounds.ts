// =============================================================================
// SOUND EFFECTS LIBRARY
// Web Audio API-based sounds for e-learning
// No external audio files required
// =============================================================================

type SoundType = 
  | 'click' 
  | 'success' 
  | 'error' 
  | 'levelUp' 
  | 'coin' 
  | 'badge' 
  | 'complete' 
  | 'start'
  | 'streak'
  | 'perfect';

type HapticType = 'light' | 'medium' | 'heavy';

// Audio context (lazy initialization)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Sound definitions
const SOUNDS: Record<SoundType, { frequency: number; duration: number; type: OscillatorType; volume: number }[]> = {
  click: [
    { frequency: 800, duration: 0.05, type: 'sine', volume: 0.3 }
  ],
  success: [
    { frequency: 523, duration: 0.1, type: 'sine', volume: 0.4 },
    { frequency: 659, duration: 0.1, type: 'sine', volume: 0.4 },
    { frequency: 784, duration: 0.15, type: 'sine', volume: 0.4 }
  ],
  error: [
    { frequency: 200, duration: 0.15, type: 'sawtooth', volume: 0.3 },
    { frequency: 150, duration: 0.15, type: 'sawtooth', volume: 0.3 }
  ],
  levelUp: [
    { frequency: 392, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 523, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 659, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 784, duration: 0.2, type: 'sine', volume: 0.5 },
    { frequency: 1047, duration: 0.3, type: 'sine', volume: 0.5 }
  ],
  coin: [
    { frequency: 987, duration: 0.05, type: 'sine', volume: 0.4 },
    { frequency: 1319, duration: 0.1, type: 'sine', volume: 0.4 }
  ],
  badge: [
    { frequency: 523, duration: 0.1, type: 'sine', volume: 0.4 },
    { frequency: 784, duration: 0.1, type: 'sine', volume: 0.4 },
    { frequency: 1047, duration: 0.2, type: 'sine', volume: 0.4 }
  ],
  complete: [
    { frequency: 523, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 659, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 784, duration: 0.15, type: 'sine', volume: 0.4 },
    { frequency: 1047, duration: 0.3, type: 'sine', volume: 0.4 }
  ],
  start: [
    { frequency: 440, duration: 0.1, type: 'sine', volume: 0.3 },
    { frequency: 554, duration: 0.1, type: 'sine', volume: 0.3 },
    { frequency: 659, duration: 0.15, type: 'sine', volume: 0.3 }
  ],
  streak: [
    { frequency: 659, duration: 0.08, type: 'sine', volume: 0.4 },
    { frequency: 784, duration: 0.08, type: 'sine', volume: 0.4 },
    { frequency: 988, duration: 0.08, type: 'sine', volume: 0.4 },
    { frequency: 1175, duration: 0.15, type: 'sine', volume: 0.4 }
  ],
  perfect: [
    { frequency: 523, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 659, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 784, duration: 0.1, type: 'sine', volume: 0.5 },
    { frequency: 1047, duration: 0.15, type: 'sine', volume: 0.5 },
    { frequency: 1319, duration: 0.15, type: 'sine', volume: 0.5 },
    { frequency: 1568, duration: 0.3, type: 'sine', volume: 0.5 }
  ]
};

/**
 * Play a sound effect
 */
export function playSound(type: SoundType): void {
  if (typeof window === 'undefined') return;
  
  try {
    const ctx = getAudioContext();
    const notes = SOUNDS[type];
    
    if (!notes) return;
    
    let delay = 0;
    
    notes.forEach((note) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = note.frequency;
      oscillator.type = note.type;
      
      // Envelope
      const startTime = ctx.currentTime + delay;
      gainNode.gain.setValueAtTime(0.001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(note.volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + note.duration + 0.1);
      
      delay += note.duration;
    });
  } catch (error) {
    console.warn('Sound playback failed:', error);
  }
}

/**
 * Play haptic feedback (mobile)
 */
export function playHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined') return;
  
  try {
    if ('vibrate' in navigator) {
      const patterns: Record<HapticType, number[]> = {
        light: [10],
        medium: [20],
        heavy: [30, 20, 30]
      };
      
      navigator.vibrate(patterns[type]);
    }
  } catch (error) {
    // Haptic not supported
  }
}

/**
 * Combined feedback (sound + haptic)
 */
export function playFeedback(sound: SoundType, haptic: HapticType = 'light'): void {
  playSound(sound);
  playHaptic(haptic);
}

/**
 * Speak text using Web Speech API
 */
export function speak(text: string, options?: { rate?: number; pitch?: number }): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  try {
    speechSynthesis.cancel(); // Cancel any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = options?.pitch ?? 1.1;
    
    speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Speech synthesis failed:', error);
  }
}

/**
 * Stop any ongoing speech
 */
export function stopSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
}

// Export types
export type { SoundType, HapticType };
