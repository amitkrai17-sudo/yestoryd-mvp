'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, LogIn, GraduationCap } from 'lucide-react';

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
          <Link href="/" className="flex items-center">
            <Image src="/images/logo.png" alt="Yestoryd" width={140} height={40} className="h-8 lg:h-10 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            <a href="#how-it-works" className="text-text-secondary hover:text-white font-medium text-sm transition-colors">The ARC Method</a>
            <a href="#rucha-story" className="text-text-secondary hover:text-white font-medium text-sm transition-colors">Our Story</a>
            <a href="#pricing" className="text-text-secondary hover:text-white font-medium text-sm transition-colors">Pricing</a>

            <div className="h-6 w-px bg-border mx-2"></div>

            <Link href="/parent/login" className="flex items-center gap-2 text-white font-bold hover:text-[#00abff] text-sm transition-colors">
              <LogIn className="w-4 h-4" /> Login
            </Link>
            <Link
              href="/assessment"
              onClick={onCTAClick}
              className="h-11 inline-flex items-center justify-center gap-2 bg-[#FF0099] text-white px-6 rounded-full font-bold hover:bg-[#e6008a] hover:shadow-lg hover:shadow-[#ff0099]/20 hover:-translate-y-0.5 transition-all duration-200 text-sm"
            >
              Reading Test - Free
            </Link>
          </nav>

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
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-white font-semibold py-2">The ARC Method</a>
            <a href="#rucha-story" onClick={() => setMobileMenuOpen(false)} className="block text-white font-semibold py-2">Our Story</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-white font-semibold py-2">Pricing</a>
            <hr className="border-border-subtle" />
            <Link href="/parent/login" onClick={() => setMobileMenuOpen(false)} className="block text-text-secondary py-2">Parent Login</Link>
            <Link href="/assessment" onClick={() => { setMobileMenuOpen(false); onCTAClick(); }} className="h-12 flex items-center justify-center gap-2 bg-[#FF0099] text-white rounded-full font-bold w-full mt-4 hover:bg-[#e6008a]">
              Reading Test - Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
