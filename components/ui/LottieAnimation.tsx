// ============================================================
// FILE: components/ui/LottieAnimation.tsx
// ============================================================
// Lottie Animation Wrapper with SSR safety and fallbacks
// ============================================================

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamic import to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface LottieAnimationProps {
  name: 'correct' | 'incorrect' | 'complete';
  size?: number;
  loop?: boolean;
  onComplete?: () => void;
}

export function LottieAnimation({
  name,
  size = 60,
  loop = false,
  onComplete
}: LottieAnimationProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/animations/${name}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Animation not found');
        return res.json();
      })
      .then(data => setAnimationData(data))
      .catch(() => setError(true));
  }, [name]);

  // Fallback if animation fails to load
  if (error) {
    const fallbackIcons: Record<string, string> = {
      correct: '✓',
      incorrect: '✗',
      complete: '★'
    };
    const fallbackColors: Record<string, string> = {
      correct: 'text-green-500',
      incorrect: 'text-gray-400',
      complete: 'text-[#FF0099]'
    };
    return (
      <div
        className={`flex items-center justify-center ${fallbackColors[name]}`}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        {fallbackIcons[name]}
      </div>
    );
  }

  if (!animationData) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={true}
      style={{ width: size, height: size }}
      onComplete={onComplete}
    />
  );
}
