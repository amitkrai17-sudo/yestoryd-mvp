// file: app/components/agreement/SignaturePad.tsx
// Canvas-based signature pad component
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
  width = 400,
  height = 150,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Set drawing style
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    setContext(ctx);
  }, [width, height, penColor, backgroundColor]);

  // Get coordinates from event (handles both mouse and touch)
  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      // Mouse event
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

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width * dpr, height * dpr);
    
    setHasSignature(false);
    onSignatureChange(null);
  }, [context, backgroundColor, width, height, onSignatureChange]);

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
    <div className="signature-pad-container">
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Pencil className="w-4 h-4" />
          Draw Your Signature
        </label>
        {hasSignature && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Signature captured
          </span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`border-2 rounded-lg cursor-crosshair touch-none ${
            disabled 
              ? 'border-gray-200 bg-gray-100 cursor-not-allowed' 
              : hasSignature 
                ? 'border-green-400 bg-white' 
                : 'border-gray-300 bg-white hover:border-pink-400'
          }`}
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
            <span className="text-gray-400 text-sm">Sign here</span>
          </div>
        )}

        {/* Signature line */}
        <div className="absolute bottom-6 left-4 right-4 border-b border-dashed border-gray-300 pointer-events-none"></div>
      </div>

      {/* Clear button */}
      {hasSignature && !disabled && (
        <button
          type="button"
          onClick={clearSignature}
          className="mt-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear & Redo
        </button>
      )}

      {/* Instructions */}
      <p className="mt-2 text-xs text-gray-500">
        Use your mouse or finger to draw your signature above. This will be your legally binding digital signature.
      </p>
    </div>
  );
}
