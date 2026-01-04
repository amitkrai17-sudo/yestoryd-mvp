'use client';

import { useEffect, useState, useRef } from 'react';
import { Share2, BookOpen } from 'lucide-react';

// Brand Colors (matching email template)
const COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  yellow: '#ffde00',
  purple: '#7b008b',
};

interface CelebrationProps {
  score: number;
  childName: string;
  childAge: number | string;
  onShare?: () => void;
}

// Score-based messaging (matching email template style)
function getScoreMessage(score: number, childName: string) {
  if (score >= 8) return {
    headline: `${childName} Is Doing Amazingly!`,
    subheadline: 'A true reading champion',
    emoji: '⭐',
    encouragement: `${score}/10 is excellent! Advanced coaching can take skills even higher.`,
  };
  if (score >= 6) return {
    headline: `${childName} Shows Great Potential!`,
    subheadline: 'A rising reading star',
    emoji: '🌟',
    encouragement: `${score}/10 shows promise! A few sessions can unlock their full ability.`,
  };
  if (score >= 4) return {
    headline: `${childName} Is On The Right Track!`,
    subheadline: 'Building reading confidence',
    emoji: '📖',
    encouragement: `${score}/10 is a great start! Targeted coaching will accelerate progress.`,
  };
  return {
    headline: `${childName} Has Taken The First Step!`,
    subheadline: 'Every reader starts somewhere',
    emoji: '🚀',
    encouragement: `Our coaches specialize in building strong foundations. Let's begin!`,
  };
}

// Age-appropriate call-to-action
function getAgeCTA(age: number, childName: string) {
  if (age <= 6) return `Show Mommy & Daddy your star! ⭐`;
  if (age <= 9) return `Share your achievement with family! 🏆`;
  return `Share your results 📊`;
}

// Full-screen Confetti Component
function FullConfetti({ active, duration = 4000 }: { active: boolean; duration?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!active) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to full screen
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const particles: Array<{
      x: number; y: number; size: number; color: string;
      vx: number; vy: number; rotation: number; rotationSpeed: number;
      shape: 'rect' | 'circle';
    }> = [];
    
    const colors = [COLORS.pink, COLORS.blue, COLORS.yellow, COLORS.purple, '#00d4aa', '#ff6b35', '#ffffff'];
    
    // Create particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height,
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
    
    const startTime = Date.now();
    let animationId: number;
    
    function animate() {
      if (!ctx || !canvas) return;
      
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const fadeStart = duration * 0.7;
      const opacity = elapsed > fadeStart 
        ? 1 - (elapsed - fadeStart) / (duration - fadeStart)
        : 1;
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.rotation += p.rotationSpeed;
        
        // Reset particles that fall off screen
        if (p.y > canvas.height + 50) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.vy = Math.random() * 3 + 2;
        }
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      });
      
      animationId = requestAnimationFrame(animate);
    }
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [active, duration]);
  
  if (!active) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
}

export default function AgeCelebration({
  score,
  childName,
  childAge,
  onShare,
}: CelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  
  const age = typeof childAge === 'string' ? parseInt(childAge) || 7 : childAge;
  const message = getScoreMessage(score, childName);
  const ageCTA = getAgeCTA(age, childName);
  
  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    // Stop confetti after 4 seconds
    const confettiTimer = setTimeout(() => setShowConfetti(false), 4000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(confettiTimer);
    };
  }, []);
  
  const handleShare = () => {
    const shareMessage = encodeURIComponent(
      `🎉 ${childName}'s Reading Assessment Results!\n\n` +
      `${message.emoji} ${message.headline}\n` +
      `📊 Score: ${score}/10\n\n` +
      `${message.subheadline}\n\n` +
      `Take the FREE assessment: yestoryd.com/assessment 📚`
    );
    window.open(`https://wa.me/?text=${shareMessage}`, '_blank');
    onShare?.();
  };
  
  return (
    <>
      {/* Full-screen Confetti */}
      <FullConfetti active={showConfetti} duration={4000} />
      
      {/* Celebration Banner */}
      <div 
        className={`relative overflow-hidden rounded-2xl mb-4 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        {/* Main celebration card - matching email purple/pink gradient */}
        <div className="relative bg-gradient-to-r from-[#ff0099] to-[#7b008b] p-4 sm:p-5">
          <div className="flex items-center gap-4">
            {/* Yestoryd Logo Badge - matching header/email */}
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/50">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-xl flex items-center justify-center">
                <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            
            {/* Text content - matching email style */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{message.emoji}</span>
                <p className="text-white/90 text-xs sm:text-sm font-medium uppercase tracking-wide">
                  Reading Assessment
                </p>
              </div>
              <h3 className="text-white text-lg sm:text-xl font-bold leading-tight">
                {message.headline}
              </h3>
              <p className="text-white/80 text-sm mt-0.5">
                {message.subheadline}
              </p>
            </div>
            
            {/* Share button */}
            <button
              onClick={handleShare}
              className="flex-shrink-0 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 rounded-full sm:rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-5 h-5 text-white" />
              <span className="hidden sm:inline text-white text-sm font-semibold">Share</span>
            </button>
          </div>
          
          {/* Encouragement banner - matching email yellow banner style */}
          <div className="mt-4 bg-[#ffde00] rounded-xl px-4 py-2.5 text-center">
            <p className="text-[#7b008b] text-sm font-semibold">
              💡 {message.encouragement}
            </p>
          </div>
          
          {/* Age-appropriate CTA */}
          <p className="text-white/70 text-xs sm:text-sm mt-3 text-center">
            {ageCTA}
          </p>
        </div>
      </div>
    </>
  );
}
