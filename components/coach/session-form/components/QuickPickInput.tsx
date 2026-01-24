// =============================================================================
// FILE: components/coach/session-form/components/QuickPickInput.tsx
// PURPOSE: Quick pick tags with custom input for highlights/challenges
// =============================================================================

'use client';

import { FC, useState } from 'react';
import { CheckCircle, X, Plus } from 'lucide-react';
import { BRAND_COLORS } from '../constants';

interface QuickPickInputProps {
  selected: string[];
  suggestions: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  maxItems: number;
  accentColor: 'green' | 'orange' | 'blue' | 'pink';
}

const COLOR_MAP = {
  green: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
    hover: BRAND_COLORS.successGreen,
  },
  orange: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    hover: BRAND_COLORS.warningOrange,
  },
  blue: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    hover: BRAND_COLORS.electricBlue,
  },
  pink: {
    bg: 'bg-[#FF0099]/20',
    border: 'border-[#FF0099]/50',
    text: 'text-[#FF0099]',
    hover: BRAND_COLORS.hotPink,
  },
};

const QuickPickInput: FC<QuickPickInputProps> = ({
  selected,
  suggestions,
  onChange,
  placeholder,
  maxItems,
  accentColor,
}) => {
  const [customInput, setCustomInput] = useState('');
  const colors = COLOR_MAP[accentColor];
  const canAddMore = selected.length < maxItems;

  const handleAddItem = (item: string) => {
    if (!selected.includes(item) && canAddMore) {
      onChange([...selected, item]);
    }
  };

  const handleRemoveItem = (index: number) => {
    onChange(selected.filter((_, i) => i !== index));
  };

  const handleCustomAdd = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed) && canAddMore) {
      onChange([...selected, trimmed]);
      setCustomInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomAdd();
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Pick Tags */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const isSelected = selected.includes(suggestion);
          const isDisabled = !canAddMore && !isSelected;

          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleAddItem(suggestion)}
              disabled={isSelected || isDisabled}
              className={`
                px-3 py-1.5 text-xs rounded-full border transition-all
                ${isSelected
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : isDisabled
                    ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-[#FF0099] hover:text-white cursor-pointer'
                }
              `}
            >
              {isSelected ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {suggestion}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  {suggestion}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={canAddMore ? placeholder : `Maximum ${maxItems} items reached`}
          disabled={!canAddMore}
          className={`
            flex-1 px-4 py-2.5 rounded-xl text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-[#FF0099] transition-all
            ${canAddMore
              ? 'bg-gray-800 border border-gray-700'
              : 'bg-gray-800/50 border border-gray-700/50 cursor-not-allowed'
            }
          `}
        />
        <button
          type="button"
          onClick={handleCustomAdd}
          disabled={!customInput.trim() || !canAddMore}
          className={`
            px-4 py-2.5 rounded-xl font-semibold transition-all
            ${customInput.trim() && canAddMore
              ? 'bg-[#FF0099] text-white hover:bg-[#FF0099]/80'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Add
        </button>
      </div>

      {/* Selected Items */}
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((item, index) => (
            <div
              key={index}
              className={`
                flex items-center gap-3 p-3 rounded-xl group
                ${colors.bg} border ${colors.border}
              `}
            >
              <CheckCircle className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
              <span className="flex-1 text-sm text-gray-300">{item}</span>
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-500/20 transition-all"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Counter */}
      <p className="text-xs text-gray-500">
        {selected.length}/{maxItems} items
      </p>
    </div>
  );
};

export default QuickPickInput;
