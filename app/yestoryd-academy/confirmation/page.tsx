// app/yestoryd-academy/confirmation/page.tsx
// Final step: Application submitted confirmation
'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  ArrowRight,
  Loader2,
  Heart,
  Calendar,
  Sparkles
} from 'lucide-react';

function ConfirmationPageContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const [applicationData, setApplicationData] = useState<any>(null);

  useEffect(() => {
    const loadApplication = async () => {
      if (!applicationId) return;

      const { data } = await supabase
        .from('coach_applications')
        .select('name, email, phone')
        .eq('id', applicationId)
        .single();

      if (data) {
        setApplicationData(data);
      }
    };

    loadApplication();
  }, [applicationId, supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={140}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Success Animation */}
        <div className="text-center mb-10">
          <div className="relative inline-block">
            <div className="w-28 h-28 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg shadow-green-200">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#ff0099] rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Application Submitted! 🎉
          </h1>

          {applicationData?.name && (
            <p className="text-xl text-slate-600">
              Thank you, <span className="font-semibold text-slate-900">{applicationData.name.split(' ')[0]}</span>!
              <br />We're excited to learn more about you.
            </p>
          )}
        </div>

        {/* What Happens Next */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#ff0099]" />
            What Happens Next
          </h2>

          <div className="space-y-6">
            {[
              {
                icon: CheckCircle2,
                title: "Application Review",
                description: "Our team reviews your responses and voice statement",
                time: "Within 48 hours",
                color: "text-green-500",
                bg: "bg-green-50"
              },
              {
                icon: Phone,
                title: "Discovery Call",
                description: "If we're a good match, Rucha (founder) will reach out for a brief call",
                time: "15-20 minutes",
                color: "text-[#ff0099]",
                bg: "bg-pink-50"
              },
              {
                icon: Calendar,
                title: "Orientation & Onboarding",
                description: "Complete platform walkthrough and receive your first student",
                time: "Within 1 week",
                color: "text-[#7b008b]",
                bg: "bg-purple-50"
              }
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center`}>
                  <step.icon className={`w-6 h-6 ${step.color}`} />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{step.time}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-slate-50 rounded-2xl p-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">We'll reach out via:</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200">
              <Mail className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-700">{applicationData?.email || 'Your email'}</span>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200">
              <MessageCircle className="w-5 h-5 text-[#25d366]" />
              <span className="text-sm text-slate-700">{applicationData?.phone || 'WhatsApp'}</span>
            </div>
          </div>
        </div>

        {/* Closing Message */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-slate-600 mb-8">
            <Heart className="w-5 h-5 text-[#ff0099]" />
            <span>Thank you for wanting to help children read better</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Visit Yestoryd
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://wa.me/918976287997?text=Hi!%20I%20just%20submitted%20my%20coach%20application%20for%20Yestoryd%20Academy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25d366] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Us
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Image
            src="/images/logo.png"
            alt="Yestoryd"
            width={100}
            height={30}
            className="h-6 w-auto mx-auto mb-4 opacity-50"
          />
          <p className="text-sm text-slate-500">
            © 2025 Yestoryd. Transforming young readers, one child at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    }>
      <ConfirmationPageContent />
    </Suspense>
  );
}
