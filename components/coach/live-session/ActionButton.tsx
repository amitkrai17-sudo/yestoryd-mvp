'use client';

import { useState, useRef, useCallback } from 'react';
import { Check, AlertTriangle, SkipForward, CircleX, X } from 'lucide-react';
import type { ActivityStatus } from './types';

interface ActionButtonProps {
  onAction: (status: ActivityStatus) => void;
  isLastActivity: boolean;
  disabled?: boolean;
}

const OPTIONS: { status: ActivityStatus; label: string; icon: React.ReactNode; bg: string }[] = [
  { status: 'completed', label: 'Done', icon: <Check className="w-5 h-5" />, bg: 'bg-green-600 active:bg-green-700' },
  { status: 'partial', label: 'Partial', icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-amber-600 active:bg-amber-700' },
  { status: 'skipped', label: 'Skip', icon: <SkipForward className="w-5 h-5" />, bg: 'bg-white/10 active:bg-white/20' },
  { status: 'struggled', label: 'Struggled', icon: <CircleX className="w-5 h-5" />, bg: 'bg-red-600 active:bg-red-700' },
];

export default function ActionButton({ onAction, isLastActivity, disabled }: ActionButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePressStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowOptions(true);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Quick tap = completed
    if (!didLongPress.current && !showOptions) {
      onAction('completed');
    }
  }, [showOptions, onAction]);

  const handlePressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (showOptions) {
    return (
      <div className="pb-[env(safe-area-inset-bottom)] bg-[#1a1f26] border-t border-white/10">
        <div className="px-4 pt-3 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt.status}
                onClick={() => {
                  setShowOptions(false);
                  onAction(opt.status);
                }}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-white min-h-[64px] transition-transform active:scale-95 ${opt.bg}`}
              >
                {opt.icon}
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowOptions(false)}
            className="w-full mt-2 py-2 text-white/50 text-xs font-medium flex items-center justify-center gap-1 active:text-white/70"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[env(safe-area-inset-bottom)] bg-[#1a1f26] border-t border-white/10">
      <div className="px-4 pt-3 pb-3">
        <button
          disabled={disabled}
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerLeave={handlePressCancel}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full py-4 bg-[#FF0099] hover:bg-[#FF0099]/90 active:scale-[0.98] text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none select-none min-h-[56px]"
        >
          <Check className="w-5 h-5" />
          {isLastActivity ? 'Done — Finish' : 'Done — Next'}
        </button>
        <p className="text-center text-white/30 text-[10px] mt-1.5">
          Hold for more options
        </p>
      </div>
    </div>
  );
}
