'use client';

import { Calendar, Clock, Info, Zap } from 'lucide-react';

interface StartDateSelectorProps {
  startOption: 'now' | 'later';
  startDate: string;
  onOptionChange: (option: 'now' | 'later') => void;
  onDateChange: (date: string) => void;
  minDate: string;
  maxDate: string;
}

export function StartDateSelector({
  startOption,
  startDate,
  onOptionChange,
  onDateChange,
  minDate,
  maxDate,
}: StartDateSelectorProps) {
  return (
    <div className="border border-border rounded-xl p-3 bg-surface-2 space-y-2">
      <label className="block text-sm font-medium text-text-secondary flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-purple-400" />
        When would you like to start?
      </label>

      {/* Option 1: Start Immediately */}
      <label
        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
          startOption === 'now'
            ? 'border-[#FF0099] bg-[#FF0099]/10'
            : 'border-border hover:border-[#FF0099]/50 bg-surface-1'
        }`}
      >
        <input
          type="radio"
          name="startOption"
          value="now"
          checked={startOption === 'now'}
          onChange={() => onOptionChange('now')}
          className="mt-0.5 w-4 h-4 text-[#FF0099] border-border focus:ring-[#FF0099]"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FF0099]" />
            <span className="font-semibold text-white text-sm">Start Immediately</span>
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
              RECOMMENDED
            </span>
          </div>
          <p className="text-text-tertiary text-xs mt-0.5">Sessions scheduled within 48 hours</p>
        </div>
      </label>

      {/* Option 2: Choose a Date */}
      <label
        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
          startOption === 'later'
            ? 'border-[#FF0099] bg-[#FF0099]/10'
            : 'border-border hover:border-[#FF0099]/50 bg-surface-1'
        }`}
      >
        <input
          type="radio"
          name="startOption"
          value="later"
          checked={startOption === 'later'}
          onChange={() => onOptionChange('later')}
          className="mt-0.5 w-4 h-4 text-[#FF0099] border-border focus:ring-[#FF0099]"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-white text-sm">Choose a Start Date</span>
          </div>
          <p className="text-text-tertiary text-xs mt-0.5">
            Perfect for after exams, holidays, or travel. Lock in today&apos;s price!
          </p>

          {/* Date Picker - Only show when "later" is selected */}
          {startOption === 'later' && (
            <div className="mt-2 space-y-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateChange(e.target.value)}
                min={minDate}
                max={maxDate}
                className="w-full px-3 py-2 border border-border rounded-lg text-white bg-surface-2 text-sm focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099]"
              />
              {startDate && (
                <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/20 p-2 rounded-lg">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Program starts:{' '}
                    <strong>
                      {new Date(startDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </label>

      {/* Info Note */}
      <div className="flex items-start gap-2 p-2 bg-blue-500/10 rounded-lg text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          {startOption === 'now'
            ? "You'll receive your schedule within 48 hours via email and WhatsApp."
            : "You'll receive a reminder 3 days before your program starts."}
        </span>
      </div>
    </div>
  );
}
