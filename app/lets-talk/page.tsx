'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  Clock,
  Video,
  Heart,
  Award,
  MessageCircle,
  ArrowRight,
  Loader2,
  Calendar,
  Sparkles,
  Shield,
  Users,
  User,
  Phone,
  Mail,
  Baby,
} from 'lucide-react';

function LetsTalkContent() {
  const searchParams = useSearchParams();
  
  // Form state - pre-fill from URL params
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
  });
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const source = searchParams.get('source') || 'direct';

  // Format phone number for Cal.com
  // Cal.com phone field auto-detects country from number
  // We need to KEEP country code for proper detection
  const formatPhoneForCal = (phone: string) => {
    // Remove spaces, dashes, parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // If already has + prefix, return as-is (properly formatted)
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Check if it's an Indian number without + prefix
    // 91 followed by 10 digits -> add + prefix
    if (/^91\d{10}$/.test(cleaned)) {
      return '+' + cleaned; // +919687606177
    }
    
    // 0 followed by 10 digits (Indian format) -> convert to +91
    if (/^0\d{10}$/.test(cleaned)) {
      return '+91' + cleaned.slice(1); // 09687606177 -> +919687606177
    }
    
    // Just 10 digits (assume Indian) -> add +91
    if (/^\d{10}$/.test(cleaned)) {
      return '+91' + cleaned; // 9687606177 -> +919687606177
    }
    
    // For other international formats without +, add + prefix
    if (cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    // Default: return as-is
    return cleaned;
  };

  // Build Cal.com URL with pre-filled params
  // Cal.com field identifiers (from your Cal.com setup):
  // - name, email = default fields
  // - attendeePhoneNumber = Phone Number custom field
  // - childName = Child Name custom field
  // - childAge = Child Age custom field
  const getCalUrl = () => {
    const params = new URLSearchParams();
    
    // Default Cal.com fields
    if (formData.parentName) params.set('name', formData.parentName);
    if (formData.parentEmail) params.set('email', formData.parentEmail);
    
    // Custom fields - use exact identifiers from Cal.com
    if (formData.parentPhone) {
      const cleanPhone = formatPhoneForCal(formData.parentPhone);
      params.set('attendeePhoneNumber', cleanPhone);
    }
    if (formData.childName) {
      params.set('childName', formData.childName);
    }
    if (formData.childAge) {
      params.set('childAge', formData.childAge);
    }
    
    const baseUrl = 'https://cal.com/yestoryd/discovery';
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  };

  // Build enroll URL with params
  const getEnrollUrl = () => {
    const params = new URLSearchParams();
    if (formData.childName) params.set('childName', formData.childName);
    if (formData.childAge) params.set('childAge', formData.childAge);
    if (formData.parentEmail) params.set('parentEmail', formData.parentEmail);
    if (formData.parentPhone) params.set('parentPhone', formData.parentPhone);
    if (formData.parentName) params.set('parentName', formData.parentName);
    params.set('source', source);
    
    return `/enroll?${params.toString()}`;
  };

  // WhatsApp
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to know more about Yestoryd's reading program${formData.childName ? ` for ${formData.childName}` : ''}.`
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setShowCalendar(true);
  };

  // Personalized CTA - returns JSX for styled name
  const renderEnrollCta = (showPrice = true) => {
    if (formData.childName) {
      return (
        <>
          Enroll <span className="text-yellow-300 font-black underline underline-offset-2">{formData.childName}</span>{showPrice ? ' — ₹5,999' : ''}
        </>
      );
    }
    return showPrice ? 'Enroll Now — ₹5,999' : 'Enroll Now';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
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
            href="/assessment"
            className="text-sm font-semibold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Take Free Assessment</span>
            <span className="sm:hidden">Free Test</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
          
          {/* Left Column - Info */}
          <div>
            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-3">
              Let us Talk About{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-400">
                {formData.childName || 'Your Child'}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base text-gray-300 mb-5">
              This is not a sales call. It's a conversation to:
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-6">
              {[
                'Understand your child\'s unique learning style',
                'Discuss the assessment findings in depth',
                'Explore what success looks like for your family',
                'See if our approach is the right fit',
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-200 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {/* Coach Card */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-5">
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  R
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Rucha</h3>
                  <p className="text-pink-400 font-medium text-sm">Founder & Lead Reading Coach</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>30 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Video className="w-4 h-4 text-green-400" />
                  <span>Video or phone</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span>10+ years exp.</span>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-l-4 border-pink-500 rounded-r-xl p-3 mb-5">
              <p className="text-gray-300 italic text-sm">
                "If we are not the right fit, I will recommend other resources that might help."
              </p>
              <p className="text-pink-400 font-semibold text-sm mt-1">— Rucha, Founder</p>
            </div>

            {/* Social Proof */}
            <div className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 border-2 border-gray-800" />
                ))}
              </div>
              <span className="text-gray-300 text-sm">
                <span className="text-white font-bold">500+</span> parents helped
              </span>
            </div>
          </div>

          {/* Right Column - Form & Calendar */}
          <div>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              
              {/* Step 1: Form (if not submitted) */}
              {!formSubmitted ? (
                <>
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-pink-400" />
                      Quick Details
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      So we can prepare for our conversation
                    </p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="p-4 space-y-3">
                    {/* Parent Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          name="parentName"
                          value={formData.parentName}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter your name"
                          className="w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="email"
                          name="parentEmail"
                          value={formData.parentEmail}
                          onChange={handleInputChange}
                          required
                          placeholder="your@email.com"
                          className="w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="tel"
                          name="parentPhone"
                          value={formData.parentPhone}
                          onChange={handleInputChange}
                          required
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                        />
                      </div>
                    </div>

                    {/* Child Name & Age - Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Child's Name</label>
                        <div className="relative">
                          <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="text"
                            name="childName"
                            value={formData.childName}
                            onChange={handleInputChange}
                            required
                            placeholder="Child's name"
                            className="w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Age</label>
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                        >
                          <option value="">Select</option>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                            <option key={age} value={age}>{age} yrs</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all mt-4"
                    >
                      <Calendar className="w-5 h-5" />
                      Choose a Time Slot
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {/* Step 2: Calendar (after form submitted) */}
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-pink-400" />
                      Choose a Time That Works
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Select a slot for {formData.childName}'s discovery call
                    </p>
                    <button 
                      onClick={() => setFormSubmitted(false)}
                      className="text-pink-400 text-xs mt-2 hover:underline"
                    >
                      ← Edit details
                    </button>
                  </div>

                  {/* Cal.com Embed */}
                  <div className="p-4">
                    <div className="bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
                      <iframe
                        src={`${getCalUrl()}&embed=true&theme=dark`}
                        width="100%"
                        height="500"
                        frameBorder="0"
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* WhatsApp Alternative */}
              <div className="p-4 border-t border-gray-700">
                <p className="text-center text-gray-400 text-xs mb-2">
                  Prefer to message directly?
                </p>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message on WhatsApp
                </a>
              </div>
            </div>

            {/* Ready to Enroll CTA */}
            <div className="mt-5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-4 border border-pink-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold text-xs">READY TO START?</span>
              </div>
              <p className="text-gray-400 text-xs mb-3">
                Skip the call & enroll {formData.childName || 'your child'} directly
              </p>
              <Link
                href={getEnrollUrl()}
                className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all text-sm"
              >
                {renderEnrollCta(true)}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  100% Refund
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  500+ Parents
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 z-40">
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 w-12 flex items-center justify-center bg-green-600 text-white rounded-xl flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
          <Link
            href={getEnrollUrl()}
            className="flex-1 h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl text-sm"
          >
            {renderEnrollCta(true)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}

export default function LetsTalkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
      </div>
    }>
      <LetsTalkContent />
    </Suspense>
  );
}