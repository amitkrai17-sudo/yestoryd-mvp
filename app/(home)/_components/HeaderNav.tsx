'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, GraduationCap, BookOpen, LogIn } from 'lucide-react';

interface HeaderNavProps {
  scrolled: boolean;
  topBarTextDesktop: string;
  topBarTextMobile: string;
  onCTAClick: () => void;
}

export function HeaderNav({
  scrolled,
  topBarTextDesktop,
  topBarTextMobile,
  onCTAClick,
}: HeaderNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-surface-1/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      {/* Top Bar */}
      <div className="bg-surface-1 text-white py-2 px-4 text-xs sm:text-sm border-b border-border-subtle">
        <div className="max-w-7xl mx-auto flex justify-center items-center">
          <p className="opacity-90 flex items-center gap-2">
            <GraduationCap className="w-3 h-3 text-[#00abff]" />
            <span className="hidden sm:inline">{topBarTextDesktop}</span>
            <span className="sm:hidden">{topBarTextMobile}</span>
          </p>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-surface-1/80 backdrop-blur-sm">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#3B82F6] rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl">
              <span className="text-[#FF2D92]">Yest</span>
              <span className="text-white">o</span>
              <span className="text-[#FBBF24]">ryd</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/classes" className="text-gray-400 hover:text-white font-medium text-sm transition-colors">Workshops</Link>
            <Link href="/english-classes" className="text-gray-400 hover:text-white font-medium text-sm transition-colors">English Classes</Link>
            <Link href="/library" className="text-gray-400 hover:text-white font-medium text-sm transition-colors">Library</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white font-medium text-sm transition-colors">Pricing</Link>
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <Link href="/parent/login" className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm transition-colors">
              <LogIn className="w-4 h-4" />
              Login
            </Link>
            <Link
              href="/assessment"
              onClick={onCTAClick}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#FF0099]/90 transition-colors text-sm"
            >
              Reading Test - Free
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface-2 border-t border-border-subtle shadow-xl absolute w-full">
          <div className="px-4 py-6 space-y-4">
            <Link href="/classes" onClick={() => setMobileMenuOpen(false)} className="block text-gray-400 hover:text-white font-medium py-2 transition-colors">Workshops</Link>
            <Link href="/english-classes" onClick={() => setMobileMenuOpen(false)} className="block text-gray-400 hover:text-white font-medium py-2 transition-colors">English Classes</Link>
            <Link href="/library" onClick={() => setMobileMenuOpen(false)} className="block text-gray-400 hover:text-white font-medium py-2 transition-colors">Library</Link>
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block text-gray-400 hover:text-white font-medium py-2 transition-colors">Pricing</Link>
            <Link href="/parent/login" onClick={() => setMobileMenuOpen(false)} className="block text-gray-400 hover:text-white font-medium py-2 transition-colors">Login</Link>
            <div className="pt-4 border-t border-gray-800 mt-2">
              <Link href="/assessment" onClick={() => { setMobileMenuOpen(false); onCTAClick(); }} className="min-h-[44px] flex items-center justify-center gap-2 bg-[#FF0099] text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-[#FF0099]/90 transition-colors">
                Reading Test - Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
