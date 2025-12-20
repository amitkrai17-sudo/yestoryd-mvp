// file: app/components/agreement/SignaturePad.tsx
// Canvas-based signature pad component - MOBILE RESPONSIVE
// Usage: <SignaturePad onSignatureChange={(dataUrl) => setSignature(dataUrl)} />

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, Check, Pencil } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
}

export default function SignaturePad({
  onSignatureChange,
  width = 300,
  height = 120,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(width);

  // Responsive width based on container
  useEffect(() => {
    const updateCanvasWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setCanvasWidth(Math.min(width, containerWidth - 4)); // -4 for border
      }
    };
    
    updateCanvasWidth();
    window.addEventListener('resize', updateCanvasWidth);
    return () => window.removeEventListener('resize', updateCanvasWidth);
  }, [width]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Set drawing style
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, height);

    setContext(ctx);
  }, [canvasWidth, height, penColor, backgroundColor]);

  // Get coordinates from event (handles both mouse and touch)
  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !context) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    context.beginPath();
    context.moveTo(coords.x, coords.y);
  }, [disabled, context, getCoordinates]);

  // Draw
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || !context) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    context.lineTo(coords.x, coords.y);
    context.stroke();
    
    if (!hasSignature) {
      setHasSignature(true);
    }
  }, [isDrawing, disabled, context, getCoordinates, hasSignature]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (!context) return;
    
    setIsDrawing(false);
    context.closePath();

    // Notify parent of signature change
    if (hasSignature && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  }, [context, hasSignature, onSignatureChange]);

  // Clear signature
  const clearSignature = useCallback(() => {
    if (!context || !canvasRef.current) return;

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvasWidth, height);
    
    setHasSignature(false);
    onSignatureChange(null);
  }, [context, backgroundColor, canvasWidth, height, onSignatureChange]);

  // Prevent scrolling when touching canvas on mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, [isDrawing]);

  return (
    <div ref={containerRef} className="signature-pad-container w-full">
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
          <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
          Draw Your Signature
        </label>
        {hasSignature && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" />
            <span className="hidden sm:inline">Signature captured</span>
            <span className="sm:hidden">Done</span>
          </span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          className={`border-2 rounded-lg cursor-crosshair touch-none w-full ${
            disabled 
              ? 'border-gray-200 bg-gray-100 cursor-not-allowed' 
              : hasSignature 
                ? 'border-green-400 bg-white' 
                : 'border-gray-300 bg-white hover:border-pink-400'
          }`}
          style={{ maxWidth: '100%' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Placeholder text when empty */}
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-xs sm:text-sm">Sign here</span>
          </div>
        )}

        {/* Signature line */}
        <div className="absolute bottom-4 sm:bottom-6 left-3 sm:left-4 right-3 sm:right-4 border-b border-dashed border-gray-300 pointer-events-none"></div>
      </div>

      {/* Clear button */}
      {hasSignature && !disabled && (
        <button
          type="button"
          onClick={clearSignature}
          className="mt-2 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-1 sm:gap-1.5 transition-colors"
        >
          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
          Clear
        </button>
      )}

      {/* Instructions */}
      <p className="mt-1.5 sm:mt-2 text-xs text-gray-500">
        <span className="hidden sm:inline">Use your mouse or finger to draw your signature above.</span>
        <span className="sm:hidden">Draw your signature above.</span>
      </p>
    </div>
  );
}
