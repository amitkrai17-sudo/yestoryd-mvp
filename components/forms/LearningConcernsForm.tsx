// ============================================================
// FILE: components/forms/LearningConcernsForm.tsx
// PURPOSE: Reusable optional learning concerns textarea.
// ============================================================

'use client';

import { MessageSquare } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function LearningConcernsForm({ value, onChange, disabled, label }: Props) {
  return (
    <div>
      <div className="relative">
        <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={label || "Any specific areas you'd like the coach to focus on?"}
          rows={3}
          maxLength={500}
          disabled={disabled}
          className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm resize-none"
        />
      </div>
    </div>
  );
}
