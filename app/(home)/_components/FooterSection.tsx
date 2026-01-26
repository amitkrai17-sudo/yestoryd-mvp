'use client';

import Link from 'next/link';
import Image from 'next/image';
import { GraduationCap, Heart } from 'lucide-react';

interface FooterSectionProps {
  description: string;
  credential: string;
  tagline: string;
}

export function FooterSection({
  description,
  credential,
  tagline,
}: FooterSectionProps) {
  return (
    <footer className="bg-[#111111] text-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <Image src="/images/logo.png" alt="Yestoryd" width={120} height={36} className="h-8 w-auto mb-4 opacity-90" />
            <p className="text-gray-500 text-sm max-w-sm mb-4">
              {description}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <GraduationCap className="w-4 h-4 text-[#00abff]" />
              {credential}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4 text-gray-300">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/assessment" className="hover:text-[#ff0099] transition-colors">Reading Test - Free</Link></li>
              <li><a href="#how-it-works" className="hover:text-[#ff0099] transition-colors">The ARC Method</a></li>
              <li><a href="#pricing" className="hover:text-[#ff0099] transition-colors">Pricing</a></li>
              <li><Link href="/lets-talk" className="hover:text-[#ff0099] transition-colors">Talk to Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-4 text-gray-300">Access</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/parent/login" className="hover:text-[#ff0099] transition-colors">Parent Login</Link></li>
              <li><Link href="/coach/login" className="hover:text-[#ff0099] transition-colors">Coach Login</Link></li>
              <li><Link href="/yestoryd-academy" className="hover:text-[#ff0099] transition-colors">Become a Coach</Link></li>
            </ul>
            <h4 className="font-bold text-sm mb-4 mt-6 text-gray-300">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/privacy" className="hover:text-[#ff0099] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[#ff0099] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} Yestoryd. All rights reserved.
          </p>
          <p className="text-gray-600 text-sm flex items-center gap-1">
            {tagline.includes('Made with') ? (
              <>
                Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> for young readers in India
              </>
            ) : tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
