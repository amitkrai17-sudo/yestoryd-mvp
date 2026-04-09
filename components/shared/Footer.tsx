import Link from 'next/link';
import Image from 'next/image';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

interface FooterProps {
  variant?: 'default' | 'coach';
  coachName?: string;
}

export function Footer({ variant = 'default', coachName }: FooterProps) {
  return (
    <footer className="bg-[#0D0D0D] border-t border-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="flex items-center mb-6">
              <Image src="/images/logo.png" alt="Yestoryd" width={140} height={40} className="h-8 w-auto" />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Workshops, English Classes, and 1:1 Coaching — powered by AI to help every child read with confidence.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-[#FBBF24] mb-5">Services</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/classes" className="text-gray-400 hover:text-white transition-colors">
                  Workshops
                </Link>
              </li>
              <li>
                <Link href="/english-classes" className="text-gray-400 hover:text-white transition-colors">
                  English Classes
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
                  1:1 Coaching
                </Link>
              </li>
              <li>
                <Link href="/library" className="text-gray-400 hover:text-white transition-colors">
                  Book Library
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-[#FBBF24] mb-5">Company</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-[#FBBF24] mb-5">Get in Touch</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`mailto:${COMPANY_CONFIG.supportEmail}`} className="text-gray-400 hover:text-white transition-colors">
                  {COMPANY_CONFIG.supportEmail}
                </a>
              </li>
              <li>
                <a href={`tel:+${COMPANY_CONFIG.leadBotWhatsApp}`} className="text-gray-400 hover:text-white transition-colors">
                  {COMPANY_CONFIG.leadBotWhatsAppDisplay}
                </a>
              </li>
              <li className="pt-3">
                <Link href="/assessment" className="text-[#FF0099] hover:text-[#FF0099]/80 font-semibold inline-flex items-center gap-2">
                  Reading Test - Free
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Yestoryd. All rights reserved.
          </p>
          <div className="flex gap-8 text-sm">
            <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Coach attribution */}
      {variant === 'coach' && coachName && (
        <div className="bg-[#1A1A1A] py-4 text-center text-sm text-gray-500">
          {coachName}'s coaching services powered by{' '}
          <Link href="https://yestoryd.com" className="text-[#FF2D92] hover:underline">
            Yestoryd.com
          </Link>
        </div>
      )}
    </footer>
  );
}
