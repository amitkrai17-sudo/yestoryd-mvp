'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, BookOpen } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  variant?: 'default' | 'coach';
  coachName?: string;
  coachSubdomain?: string;
}

export function Header({ variant = 'default', coachName, coachSubdomain }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainNavLinks = [
    { href: '/services/coaching', label: 'Coaching' },
    { href: '/services/elearning', label: 'eLearning' },
    { href: '/services/storytelling', label: 'Storytelling' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/about', label: 'About' },
  ];

  const coachNavLinks = [
    { href: `/${coachSubdomain}`, label: 'Home' },
    { href: `/${coachSubdomain}/assessment`, label: 'Take Assessment' },
    { href: `/${coachSubdomain}/book`, label: 'Book Session' },
  ];

  const navLinks = variant === 'coach' ? coachNavLinks : mainNavLinks;

  return (
    <header className="sticky top-0 z-50 bg-[#0D0D0D]/95 backdrop-blur-md border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href={variant === 'coach' ? `/${coachSubdomain}` : '/'} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#3B82F6] rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              {variant === 'coach' ? (
                <>
                  <span className="font-bold text-xl text-white">{coachName}</span>
                  <span className="text-xs text-[#FF2D92] block -mt-1">Powered by Yestoryd</span>
                </>
              ) : (
                <span className="font-bold text-2xl">
                  <span className="text-[#FF2D92]">Yest</span>
                  <span className="text-white">o</span>
                  <span className="text-[#FBBF24]">ryd</span>
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-white font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {variant === 'coach' ? (
              <Link href={`/${coachSubdomain}/assessment`}>
                <Button className="bg-[#FF2D92] hover:bg-[#FF1A85] text-white rounded-xl px-6">
                  Take Free Assessment
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/assessment">
                  <Button variant="outline" className="border-2 border-gray-700 text-white hover:bg-gray-800 rounded-xl px-6">
                    Free Assessment
                  </Button>
                </Link>
                <Link href="/partner">
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl px-6">
                    Become a Coach
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-gray-800 bg-[#0D0D0D]">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-white font-medium py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-800 mt-2 space-y-3">
                {variant === 'coach' ? (
                  <Link href={`/${coachSubdomain}/assessment`}>
                    <Button className="w-full bg-[#FF2D92] hover:bg-[#FF1A85] text-white rounded-xl">
                      Take Free Assessment
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/assessment">
                      <Button variant="outline" className="w-full border-2 border-gray-700 text-white rounded-xl">
                        Free Assessment
                      </Button>
                    </Link>
                    <Link href="/partner">
                      <Button className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl">
                        Become a Coach
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
