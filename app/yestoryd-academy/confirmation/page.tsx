// app/yestoryd-academy/confirmation/page.tsx
// Confirmation page after coach application submission

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Clock, 
  Mail, 
  MessageCircle,
  Calendar,
  ArrowRight,
  Home,
  Sparkles
} from 'lucide-react';

export default function ApplicationConfirmationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/images/logo.png" 
              alt="Yestoryd" 
              width={120} 
              height={35}
              className="h-8 w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Application Submitted Successfully!
          </h1>
          
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            Thank you for your interest in partnering with Yestoryd. We're excited to learn more about you.
          </p>

          {/* Timeline */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-slate-900 mb-4 text-center">What Happens Next?</h3>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Application Received</h4>
                  <p className="text-sm text-slate-600">Your information and AI assessment are with us.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Review in Progress</h4>
                  <p className="text-sm text-slate-600">Our team reviews your application within 48 hours.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Discovery Conversation</h4>
                  <p className="text-sm text-slate-600">If we're a good match, we'll invite you for a 30-minute video call with our founders.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Welcome Aboard!</h4>
                  <p className="text-sm text-slate-600">Complete onboarding, sign agreement, and receive your first student.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Communication Note */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h4 className="font-medium text-slate-900 text-sm">Check Your Email</h4>
                <p className="text-sm text-slate-600 mt-1">
                  We've sent a confirmation to your email. All updates about your application will be sent there. 
                  Please also check your spam folder.
                </p>
              </div>
            </div>
          </div>

          {/* WhatsApp Note */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h4 className="font-medium text-slate-900 text-sm">WhatsApp Updates</h4>
                <p className="text-sm text-slate-600 mt-1">
                  You may also receive updates on WhatsApp at the number you provided. 
                  Save our number: <span className="font-medium">+91 XXXXX XXXXX</span>
                </p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Link>
            <Link
              href="/yestoryd-academy"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
            >
              Learn More About Yestoryd
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Questions Section */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Have questions? Email us at{' '}
            <a href="mailto:coaches@yestoryd.com" className="text-pink-600 hover:underline">
              coaches@yestoryd.com
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 mt-12 border-t border-slate-100">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © 2025 Yestoryd. Transforming young readers, one child at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}