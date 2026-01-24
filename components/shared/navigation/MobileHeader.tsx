'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  rightContent?: React.ReactNode;
}

export default function MobileHeader({
  title,
  showBack = false,
  backHref,
  rightContent,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-lg border-b border-gray-800 lg:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Back button or spacer */}
        <div className="w-10">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Center: Title */}
        {title && (
          <h1 className="text-base font-semibold text-white truncate">
            {title}
          </h1>
        )}

        {/* Right: Custom content or spacer */}
        <div className="w-10 flex justify-end">{rightContent}</div>
      </div>
    </header>
  );
}
