'use client';

import { useEffect, useRef } from 'react';

interface ConfettiProps {
  duration?: number; // Duration in milliseconds
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

// Yestoryd brand colors + celebration colors
const CONFETTI_COLORS = [
  '#ff0099', // Yestoryd pink
  '#7b008b', // Yestoryd purple
  '#00abff', // Yestoryd blue
  '#ffde00', // Yellow
  '#00d4aa', // Teal
  '#ff6b35', // Orange
  '#8b5cf6', // Violet
];

export default function Confetti({ duration = 4000, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to full screen
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create confetti particles
    const createParticles = () => {
      const particles: Particle[] = [];
      const particleCount = 150;

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height, // Start above screen
          size: Math.random() * 10 + 5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          velocityX: (Math.random() - 0.5) * 4,
          velocityY: Math.random() * 3 + 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          opacity: 1,
        });
      }
      return particles;
    };

    particlesRef.current = createParticles();
    startTimeRef.current = Date.now();

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      const elapsed = Date.now() - (startTimeRef.current || 0);
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.rotation += particle.rotationSpeed;

        // Add gravity effect
        particle.velocityY += 0.1;

        // Fade out towards the end
        if (progress > 0.7) {
          particle.opacity = 1 - ((progress - 0.7) / 0.3);
        }

        // Draw particle
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;

        // Draw rectangle confetti
        ctx.fillRect(
          -particle.size / 2,
          -particle.size / 4,
          particle.size,
          particle.size / 2
        );

        ctx.restore();
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
