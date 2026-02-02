import Link from 'next/link';
import { BookOpen } from 'lucide-react';

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
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF2D92] to-[#3B82F6] rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl">
                <span className="text-[#FF2D92]">Yest</span>
                <span className="text-white">o</span>
                <span className="text-[#FBBF24]">ryd</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Unlock your child's reading potential with AI-powered assessments and personalized coaching.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-[#FBBF24] mb-5">Services</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/services/coaching" className="text-gray-400 hover:text-white transition-colors">
                  Personalized Coaching
                </Link>
              </li>
              <li>
                <Link href="/services/elearning" className="text-gray-400 hover:text-white transition-colors">
                  eLearning Library
                </Link>
              </li>
              <li>
                <Link href="/services/storytelling" className="text-gray-400 hover:text-white transition-colors">
                  Storytelling Sessions
                </Link>
              </li>
              <li>
                <Link href="/services/podcasts" className="text-gray-400 hover:text-white transition-colors">
                  Podcasts
                </Link>
              </li>
              <li>
                <Link href="/services/physical-classes" className="text-gray-400 hover:text-white transition-colors">
                  Physical Classes
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
                <Link href="/partner" className="text-gray-400 hover:text-white transition-colors">
                  Become a Coach
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-[#FBBF24] mb-5">Get in Touch</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:engage@yestoryd.com" className="text-gray-400 hover:text-white transition-colors">
                  engage@yestoryd.com
                </a>
              </li>
              <li>
                <a href="tel:+919876543210" className="text-gray-400 hover:text-white transition-colors">
                  +91 98765 43210
                </a>
              </li>
              <li className="pt-3">
                <Link href="/assessment" className="text-[#FF2D92] hover:text-[#FF1A85] font-semibold inline-flex items-center gap-2">
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
