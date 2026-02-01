'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, GraduationCap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSessionDurations } from '@/contexts/SiteSettingsContext';

export default function TermsOfServicePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const durations = useSessionDurations();

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
        <div className="bg-gradient-to-r from-[#00ABFF] to-[#7B008B] py-12 mb-8">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white">Terms of Service</h1>
            <p className="text-white/80 mt-2">Last updated: December 29, 2025</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8 space-y-8 text-gray-700">
            
            <section>
              <p className="text-lg">
                Welcome to Yestoryd! These Terms of Service (&quot;Terms&quot;) govern your use of our 
                AI-powered reading coaching platform. By using our services, you agree to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Definitions</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>&quot;Platform&quot;</strong> refers to yestoryd.com and all related services</li>
                <li><strong>&quot;User&quot;</strong> refers to parents/guardians who create accounts</li>
                <li><strong>&quot;Child&quot;</strong> refers to the minor (aged 4-12) enrolled in our program</li>
                <li><strong>&quot;Coach&quot;</strong> refers to certified reading coaches</li>
                <li><strong>&quot;Services&quot;</strong> includes assessments, coaching, and progress tracking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Eligibility</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You must be at least 18 years old and a legal guardian of the enrolled child</li>
                <li>Our coaching services are designed for children aged 4-12 years</li>
                <li>You must provide accurate information during registration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Our Services</h2>
              
              <h3 className="text-lg font-semibold text-[#00ABFF] mt-6 mb-3">3.1 Reading Assessment (FREE)</h3>
              <p className="mb-3">Our AI-powered reading assessment evaluates your child&apos;s reading level, fluency, accuracy, and comprehension using audio recording.</p>

              <h3 className="text-lg font-semibold text-[#FF0099] mt-6 mb-3">3.2 Coaching Program</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>3-month program with 6 coaching sessions + 3 parent check-ins</li>
                <li>1:1 personalized coaching sessions with certified coaches</li>
                <li>AI-powered progress tracking and recommendations</li>
                <li>Parent dashboard with real-time progress updates</li>
                <li>Sessions conducted online via Google Meet (coaching: {durations.coaching} min, check-ins: {durations.checkin} min)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Pricing and Payment</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Reading assessment is FREE</li>
                <li>Coaching program pricing is displayed on our website</li>
                <li>All prices are in Indian Rupees (INR) inclusive of taxes</li>
                <li>Payment processed securely through Razorpay</li>
                <li>Full payment required before sessions begin</li>
              </ul>

              <h3 className="text-lg font-semibold text-[#FF0099] mt-6 mb-3">4.1 Refund Policy</h3>
              <div className="bg-[#FF0099]/5 border-l-4 border-[#FF0099] p-4 rounded-r-xl">
                <p className="font-semibold text-[#FF0099] mb-3">Please read carefully:</p>
                <ul className="space-y-3 text-sm">
                  <li>
                    <strong>Within 7 days of payment:</strong> Full refund available, no questions asked.
                  </li>
                  <li>
                    <strong>After 7 days:</strong> No refunds will be processed except in the following circumstances:
                    <ul className="list-disc pl-6 mt-2 space-y-1">
                      <li><strong>Coach-related issues:</strong> If there are genuine concerns with the assigned coach that cannot be resolved by assigning an alternative coach.</li>
                      <li><strong>Health/medical issues:</strong> If the child is unable to continue due to health reasons, supported by documentation, and after exploring options like rescheduling or pausing the program.</li>
                    </ul>
                  </li>
                  <li className="pt-2 border-t border-[#FF0099]/20">
                    <strong>Note:</strong> In both exceptional cases, we will first attempt to find alternative solutions (different coach, rescheduled sessions, program pause) before processing any refund.
                  </li>
                </ul>
              </div>
              <p className="mt-4">
                Refund requests: <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline font-medium">engage@yestoryd.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Cancellation and Rescheduling</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Reschedule/cancel 24+ hours before session: No penalty, session can be rescheduled</li>
                <li>Cancel within 24 hours: Session may be marked as completed</li>
                <li>No-show without notice: Session will be marked as completed</li>
                <li>Rescheduled sessions must be completed within the program duration or within 30 days of program end date</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. User Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate information about yourself and your child</li>
                <li>Ensure your child is present and ready for scheduled sessions</li>
                <li>Provide a quiet environment with stable internet connection</li>
                <li>Respect coaches and staff with courteous communication</li>
                <li>Not record sessions without explicit permission</li>
                <li>Support your child&apos;s learning by practicing at home as recommended</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Prohibited Conduct</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the platform for any unlawful purpose</li>
                <li>Harass, abuse, or harm coaches or staff</li>
                <li>Attempt to access other users&apos; accounts or data</li>
                <li>Reverse engineer or copy our platform&apos;s technology</li>
                <li>Share or redistribute our proprietary content</li>
                <li>Misuse the refund policy or make false claims</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Disclaimer</h2>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl">
                <p className="font-semibold text-amber-800">Educational Services Disclaimer:</p>
                <p className="mt-2 text-amber-700 text-sm">
                  Results vary based on individual factors including child&apos;s engagement, practice at home, 
                  and consistency in attending sessions. We do not guarantee specific reading improvements. 
                  Our AI assessments are educational tools, not medical or psychological diagnostic devices.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Yestoryd is not liable for indirect or consequential damages</li>
                <li>Our total liability is limited to the amount paid for the current program</li>
                <li>We are not liable for technical failures or third-party service disruptions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Privacy</h2>
              <p>
                Your use of our services is also governed by our{' '}
                <Link href="/privacy" className="text-[#FF0099] hover:underline font-medium">Privacy Policy</Link>, 
                which explains how we collect and protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Termination</h2>
              <p className="mb-3">We may suspend or terminate your account if you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate these Terms</li>
                <li>Engage in abusive behavior toward coaches or staff</li>
                <li>Provide false information</li>
                <li>Misuse the refund policy</li>
                <li>Fail to pay for services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Dispute Resolution</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informal Resolution:</strong> Contact engage@yestoryd.com first. We aim to resolve all disputes amicably within 7 business days.</li>
                <li><strong>Governing Law:</strong> Laws of India</li>
                <li><strong>Jurisdiction:</strong> Courts in Mumbai, Maharashtra</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="font-bold text-gray-900">Yestoryd</p>
                <p>Email: <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline">engage@yestoryd.com</a></p>
                <p>Phone: <a href="tel:+918976287997" className="text-[#FF0099] hover:underline">+91 8976287997</a></p>
                <p>Website: <a href="https://yestoryd.com" className="text-[#FF0099] hover:underline">yestoryd.com</a></p>
                <p className="mt-3 pt-3 border-t border-gray-200">
                  <span className="font-semibold">Grievance Officer:</span> Rucha Rai<br />
                  Email: <a href="mailto:engage@yestoryd.com" className="text-[#FF0099] hover:underline">engage@yestoryd.com</a><br />
                  Phone: <a href="tel:+918976287997" className="text-[#FF0099] hover:underline">+91 8976287997</a>
                </p>
              </div>
            </section>

            <section className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500">
                By creating an account or using our services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
