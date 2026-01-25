'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, GraduationCap } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PrivacyPolicyPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'}`}>
        <div className="bg-[#1a1a2e] text-white py-2 px-4 text-xs sm:text-sm">
          <div className="max-w-7xl mx-auto flex justify-center items-center">
            <p className="opacity-90 flex items-center gap-2">
              <GraduationCap className="w-3 h-3 text-[#00abff]" />
              <span>Certified Phonics Expert</span>
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link href="/" className="flex items-center">
              <Image src="/images/logo.png" alt="Yestoryd" width={140} height={40} className="h-8 lg:h-10 w-auto" />
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
              <Link href="/#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">How It Works</Link>
              <Link href="/#rucha-story" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Our Story</Link>
              <Link href="/#pricing" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</Link>
              <div className="h-6 w-px bg-gray-200 mx-2"></div>
              <Link href="/assessment" className="h-11 inline-flex items-center justify-center gap-2 bg-[#e6008a] text-white px-6 rounded-full font-bold hover:bg-[#d10080] hover:shadow-lg hover:shadow-[#ff0099]/20 hover:-translate-y-0.5 transition-all duration-200 text-sm">
                Reading Test - Free
              </Link>
            </nav>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-gray-900">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4">
            <nav className="flex flex-col gap-4">
              <Link href="/#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium">How It Works</Link>
              <Link href="/#rucha-story" className="text-gray-600 hover:text-gray-900 font-medium">Our Story</Link>
              <Link href="/#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link href="/assessment" className="bg-[#e6008a] text-white px-6 py-3 rounded-full font-bold text-center">Reading Test - Free</Link>
            </nav>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="pt-32 lg:pt-40 pb-16">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] py-12 mb-8">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white">Privacy Policy</h1>
            <p className="text-white/80 mt-2">Last updated: December 29, 2025</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8 space-y-8 text-gray-700">
            
            <section>
              <p className="text-lg">
                Yestoryd (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting the privacy of 
                children and their families. This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our AI-powered reading coaching platform.
              </p>
              <p className="mt-4">
                We comply with India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act) and take 
                special care when handling children&apos;s data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
              
              <h3 className="text-lg font-semibold text-[#FF0099] mt-6 mb-3">1.1 Parent/Guardian Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Full name and contact details (email, phone number)</li>
                <li>Billing address for payment processing</li>
                <li>Communication preferences</li>
                <li>Account credentials</li>
              </ul>

              <h3 className="text-lg font-semibold text-[#FF0099] mt-6 mb-3">1.2 Child Information</h3>
              <p className="mb-3">With verifiable parental consent, we collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Child&apos;s first name and age</li>
                <li>School name and grade (optional)</li>
                <li>Reading assessment results and progress data</li>
                <li>Audio recordings during reading assessments</li>
                <li>Video/audio recordings of coaching sessions (with consent)</li>
                <li>Learning preferences and areas for improvement</li>
              </ul>

              <h3 className="text-lg font-semibold text-[#FF0099] mt-6 mb-3">1.3 Automatically Collected Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device information (browser type, operating system)</li>
                <li>Usage data (pages visited, features used)</li>
                <li>IP address and approximate location</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Provide Services:</strong> Deliver reading assessments, coaching sessions, and personalized learning recommendations</li>
                <li><strong>AI Analysis:</strong> Use audio recordings to analyze reading patterns, identify gaps, and generate improvement suggestions</li>
                <li><strong>Progress Tracking:</strong> Create reports and dashboards showing your child&apos;s reading progress</li>
                <li><strong>Communication:</strong> Send session reminders, progress updates, and important notifications via email, SMS, or WhatsApp</li>
                <li><strong>Payment Processing:</strong> Process payments securely through Razorpay</li>
                <li><strong>Service Improvement:</strong> Analyze aggregated, anonymized data to improve our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Children&apos;s Privacy (Special Protections)</h2>
              <div className="bg-[#FF0099]/5 border-l-4 border-[#FF0099] p-4 rounded-r-xl mb-4">
                <p className="font-semibold text-[#FF0099]">We take children&apos;s privacy extremely seriously.</p>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Parental Consent:</strong> We require verifiable parental consent before collecting any child&apos;s personal information</li>
                <li><strong>Minimal Collection:</strong> We only collect information necessary to provide our educational services</li>
                <li><strong>No Marketing to Children:</strong> We do not use children&apos;s data for marketing purposes</li>
                <li><strong>No Third-Party Advertising:</strong> We do not display third-party advertisements to children</li>
                <li><strong>Parental Access:</strong> Parents can review, modify, or delete their child&apos;s information at any time</li>
                <li><strong>Secure Storage:</strong> All child data is encrypted and stored securely</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Audio and Video Recordings</h2>
              
              <h3 className="text-lg font-semibold text-[#00ABFF] mt-6 mb-3">4.1 Reading Assessment Recordings</h3>
              <p className="mb-3">During reading assessments, we record your child&apos;s voice to analyze reading fluency, accuracy, and comprehension.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Processed by our AI system (Google Gemini) to generate assessment reports</li>
                <li>Stored securely and encrypted</li>
                <li>Accessible only to authorized personnel and your assigned coach</li>
                <li>Retained for the duration of your enrollment plus 90 days</li>
                <li>Deleted upon request or account termination</li>
              </ul>

              <h3 className="text-lg font-semibold text-[#00ABFF] mt-6 mb-3">4.2 Coaching Session Recordings</h3>
              <p className="mb-3">Coaching sessions may be recorded (with your consent) for quality assurance.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Used to generate session summaries and track progress</li>
                <li>Shared only with your assigned coach and platform administrators</li>
                <li>Never shared with third parties without explicit consent</li>
                <li>Deleted within 90 days after the coaching program ends</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
              <p className="mb-4">We do not sell your personal information. We may share data with:</p>
              
              <h3 className="text-lg font-semibold text-[#7B008B] mt-6 mb-3">5.1 Service Providers</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Razorpay:</strong> Payment processing</li>
                <li><strong>Google Cloud/Gemini:</strong> AI-powered reading analysis</li>
                <li><strong>Supabase:</strong> Secure database hosting</li>
                <li><strong>SendGrid:</strong> Email delivery</li>
                <li><strong>AiSensy:</strong> WhatsApp messaging</li>
                <li><strong>Recall.ai:</strong> Session recording and transcription</li>
                <li><strong>Cal.com:</strong> Discovery call scheduling</li>
                <li><strong>Google Calendar:</strong> Coaching session scheduling</li>
              </ul>

              <h3 className="text-lg font-semibold text-[#7B008B] mt-6 mb-3">5.2 Legal Requirements</h3>
              <p>We may disclose information if required by law, court order, or government request.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Security</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>SSL/TLS encryption for all data transmission</li>
                <li>Encrypted database storage</li>
                <li>Role-based access controls</li>
                <li>Regular security audits</li>
                <li>Secure authentication via Supabase Auth</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Active accounts:</strong> Data retained while your account is active</li>
                <li><strong>Assessment recordings:</strong> Retained during enrollment + 90 days</li>
                <li><strong>Session recordings:</strong> Deleted within 90 days after program completion</li>
                <li><strong>Payment records:</strong> Retained for 7 years (legal requirement)</li>
                <li><strong>Deleted accounts:</strong> Personal data erased within 30 days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Your Rights (Under DPDP Act)</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Erasure:</strong> Request deletion of your data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time</li>
                <li><strong>Grievance Redressal:</strong> Lodge complaints about data handling</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, contact us at <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline font-medium">engage@yestoryd.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Contact Us</h2>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="font-bold text-gray-900">Yestoryd</p>
                <p>Email: <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline">engage@yestoryd.com</a></p>
                <p>Phone: <a href="tel:+918976287997" className="text-[#FF0099] hover:underline">+91 8976287997</a></p>
                <p className="mt-3 pt-3 border-t border-gray-200">
                  <span className="font-semibold">Grievance Officer:</span> Rucha Rai<br />
                  Email: <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline">engage@yestoryd.com</a><br />
                  Phone: <a href="tel:+918976287997" className="text-[#FF0099] hover:underline">+91 8976287997</a><br />
                  Response time: Within 72 hours
                </p>
              </div>
            </section>

            <section className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500">
                By using Yestoryd, you consent to this Privacy Policy and our collection, use, and sharing of your information as described herein.
              </p>
            </section>

          </div>
        </div>
      </main>

      {/* Footer - Matching Homepage */}
      <footer className="bg-[#111111] text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Image src="/images/logo.png" alt="Yestoryd" width={120} height={36} className="h-8 w-auto mb-4 opacity-90" />
              <p className="text-gray-500 text-sm max-w-sm mb-4">
                AI-powered reading assessment and expert coaching for children aged 4-12.
                rAI diagnoses. Coach delivers. You see everything.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <GraduationCap className="w-4 h-4 text-[#00abff]" />
                Jolly Phonics &amp; Grammar Certified
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/assessment" className="hover:text-[#ff0099] transition-colors">Reading Test - Free</Link></li>
                <li><Link href="/#how-it-works" className="hover:text-[#ff0099] transition-colors">How It Works</Link></li>
                <li><Link href="/#pricing" className="hover:text-[#ff0099] transition-colors">Pricing</Link></li>
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
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} Yestoryd. All rights reserved.</p>
            <p className="text-gray-600 text-sm">Made with ❤️ for young readers in India</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
