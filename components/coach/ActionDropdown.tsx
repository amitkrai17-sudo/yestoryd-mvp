// components/coach/ActionDropdown.tsx
// Dropdown menu for secondary session actions

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  RefreshCw,
  XCircle,
  Ban,
  CheckCircle,
  Eye,
  FileText,
} from 'lucide-react';

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning';
  disabled?: boolean;
  disabledReason?: string;
}

interface ActionDropdownProps {
  actions: ActionItem[];
}

export function ActionDropdown({ actions }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getVariantClasses = (variant: ActionItem['variant']) => {
    switch (variant) {
      case 'danger':
        return 'text-red-400 hover:bg-red-500/10';
      case 'warning':
        return 'text-yellow-400 hover:bg-yellow-500/10';
      default:
        return 'text-gray-300 hover:bg-gray-700';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                if (!action.disabled) {
                  action.onClick();
                  setIsOpen(false);
                }
              }}
              disabled={action.disabled}
              title={action.disabled ? action.disabledReason : undefined}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                ${action.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : getVariantClasses(action.variant)
                }
              `}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Pre-configured action icons for convenience
export const ActionIcons = {
  reschedule: <RefreshCw className="w-4 h-4" />,
  cancel: <XCircle className="w-4 h-4" />,
  missed: <Ban className="w-4 h-4" />,
  complete: <CheckCircle className="w-4 h-4" />,
  view: <Eye className="w-4 h-4" />,
  prep: <FileText className="w-4 h-4" />,
};
