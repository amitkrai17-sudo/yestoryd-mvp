'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Phone } from 'lucide-react';

export function EnrollHeader() {
  return (
    <header className="sticky top-0 z-50 bg-surface-1 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="Yestoryd"
            width={120}
            height={36}
            className="h-8 w-auto"
          />
        </Link>
        <Link
          href="/lets-talk"
          className="text-sm font-semibold text-[#FF0099] hover:text-[#ff0099]/80 transition-colors flex items-center gap-1"
        >
          <Phone className="w-4 h-4" />
          <span className="hidden sm:inline">Book Free Call</span>
          <span className="sm:hidden">Free Call</span>
        </Link>
      </div>
    </header>
  );
}
