// components/coach/ActionDropdown.tsx
// Dropdown menu for secondary session actions
// Bottom sheet on mobile, dropdown on desktop

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
  X,
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

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when bottom sheet is open on mobile
  useEffect(() => {
    if (isOpen) {
      // Only lock on mobile (check viewport width)
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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

  const handleAction = (action: ActionItem) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 lg:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="w-4 h-4 lg:w-5 lg:h-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop - above bottom nav */}
          <div
            className="fixed inset-0 bg-black/50 z-[55] lg:bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          {/* Bottom sheet on mobile (above bottom nav), dropdown on desktop */}
          <div className="fixed inset-x-0 bottom-20 z-[60] px-4 lg:absolute lg:inset-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-1 lg:px-0">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl lg:w-48 overflow-hidden">
              {/* Mobile header with close */}
              <div className="flex items-center justify-between p-3 border-b border-gray-800 lg:hidden">
                <span className="text-sm font-medium text-white">Actions</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Actions list */}
              <div className="py-1 lg:py-1">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleAction(action)}
                    disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : undefined}
                    className={`
                      w-full px-4 py-3 lg:py-2.5 text-left text-sm flex items-center gap-3 transition-colors
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

              {/* Safe area padding for mobile */}
              <div className="h-4 lg:hidden" />
            </div>
          </div>
        </>
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
