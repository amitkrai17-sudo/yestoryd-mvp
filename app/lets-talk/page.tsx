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
  Brain,
  Eye,
  PhoneCall,
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
  const formatPhoneForCal = (phone: string) => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    if (/^91\d{10}$/.test(cleaned)) {
      return '+' + cleaned;
    }
    
    if (/^0\d{10}$/.test(cleaned)) {
      return '+91' + cleaned.slice(1);
    }
    
    if (/^\d{10}$/.test(cleaned)) {
      return '+91' + cleaned;
    }
    
    if (cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    return cleaned;
  };

  // Build Cal.com URL with pre-filled params
  const getCalUrl = () => {
    const params = new URLSearchParams();
    
    if (formData.parentName) params.set('name', formData.parentName);
    if (formData.parentEmail) params.set('email', formData.parentEmail);
    
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-white">
      {/* Header - LIGHT THEME to match homepage */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
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
            className="text-sm font-semibold text-[#ff0099] hover:text-[#e6008a] transition-colors flex items-center gap-1"
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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight mb-3">
              Let's Talk About{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                {formData.childName || 'Your Child'}
              </span>
            </h1>

            {/* Subheadline - IMPROVED: Less defensive, more value-focused */}
            <p className="text-base text-gray-600 mb-5">
              A friendly 30-minute conversation to understand your child's needs:
            </p>

            {/* Benefits - IMPROVED: More specific outcomes */}
            <div className="space-y-3 mb-6">
              {[
                { icon: Brain, text: 'Review the AI assessment findings together', color: '#00ABFF' },
                { icon: Heart, text: 'Understand your child\'s unique learning style', color: '#FF0099' },
                { icon: Eye, text: 'See exactly how our coaching approach works', color: '#7B008B' },
                { icon: CheckCircle, text: 'Get honest advice — even if we\'re not the right fit', color: '#22c55e' },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-gray-700 text-sm pt-1">{item.text}</span>
                </div>
              ))}
            </div>

            {/* NEW: What Happens on This Call - StoryBrand "The Plan" */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[#00ABFF]" />
                What Happens on This Call
              </h3>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'We review your child\'s assessment results' },
                  { num: '2', text: 'You share any concerns or goals' },
                  { num: '3', text: 'We explain how coaching would work for your child' },
                  { num: '4', text: 'You decide if it\'s the right fit (no pressure!)' },
                ].map((step) => (
                  <div key={step.num} className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-[#ff0099] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {step.num}
                    </span>
                    <span className="text-gray-600 text-sm">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Card - FIXED: 7 years (consistent) */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-5">
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  R
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Rucha</h3>
                  <p className="text-[#ff0099] font-medium text-sm">Founder & Lead Reading Coach</p>
                </div>
              </div>

              {/* FIXED: 7 years instead of 10+ */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-[#00ABFF]" />
                  <span>30 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Video className="w-4 h-4 text-green-500" />
                  <span>Video or phone</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Heart className="w-4 h-4 text-[#ff0099]" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <Award className="w-4 h-4 text-[#ffde00]" />
                  <span>7 years exp.</span>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5 border-l-4 border-[#ff0099] rounded-r-xl p-4 mb-5">
              <p className="text-gray-600 italic text-sm">
                "If we're not the right fit, I'll honestly tell you and recommend other resources that might help."
              </p>
              <p className="text-[#ff0099] font-semibold text-sm mt-2">— Rucha, Founder</p>
            </div>

            {/* Social Proof - Simplified, more credible */}
            <div className="bg-white rounded-xl p-4 flex items-center justify-center gap-3 border border-gray-200">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff0099] to-[#7b008b] border-2 border-white" />
                ))}
              </div>
              <span className="text-gray-600 text-sm">
                <span className="text-gray-900 font-bold">100+</span> families helped
              </span>
            </div>
          </div>

          {/* Right Column - Form & Calendar */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              
              {/* Step 1: Form (if not submitted) */}
              {!formSubmitted ? (
                <>
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Book Your Free Call
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Quick details so we can prepare
                    </p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                    {/* Parent Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          name="parentName"
                          value={formData.parentName}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter your name"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          name="parentEmail"
                          value={formData.parentEmail}
                          onChange={handleInputChange}
                          required
                          placeholder="your@email.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          name="parentPhone"
                          value={formData.parentPhone}
                          onChange={handleInputChange}
                          required
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Child Name & Age - Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Child's Name</label>
                        <div className="relative">
                          <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            name="childName"
                            value={formData.childName}
                            onChange={handleInputChange}
                            required
                            placeholder="Child's name"
                            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-[#ff0099] focus:border-[#ff0099] text-sm transition-all"
                        >
                          <option value="">Select</option>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                            <option key={age} value={age}>{age} yrs</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Submit - PRIMARY CTA for this page */}
                    <button
                      type="submit"
                      className="w-full h-14 flex items-center justify-center gap-2 bg-[#e6008a] hover:bg-[#d10080] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#ff0099]/20 mt-2"
                    >
                      <Calendar className="w-5 h-5" />
                      Choose a Time Slot
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-green-500" />
                        100% Free
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00ABFF]" />
                        30 min
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#ff0099]" />
                        No obligation
                      </span>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  {/* Step 2: Calendar (after form submitted) */}
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#ff0099]/5 to-[#7b008b]/5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#ff0099]" />
                      Choose a Time That Works
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Select a slot for {formData.childName}'s discovery call
                    </p>
                    <button 
                      onClick={() => setFormSubmitted(false)}
                      className="text-[#ff0099] text-xs mt-2 hover:underline"
                    >
                      ← Edit details
                    </button>
                  </div>

                  {/* Cal.com Embed - LIGHT THEME */}
                  <div className="p-4">
                    <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200" style={{ minHeight: '500px' }}>
                      <iframe
                        src={`${getCalUrl()}&embed=true&theme=light`}
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
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <p className="text-center text-gray-500 text-xs mb-2">
                  Prefer to message directly?
                </p>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message on WhatsApp
                </a>
              </div>
            </div>

            {/* REMOVED: "Ready to Enroll" CTA - This page is for discovery calls, not enrollment */}
            {/* The enroll option is intentionally removed to reduce confusion and focus on booking */}
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA - FIXED: Focus on booking, not enrollment */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40 shadow-lg">
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 w-14 flex items-center justify-center bg-[#25d366] text-white rounded-xl flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
          {/* Changed from "Enroll" to "Book Call" - matches page purpose */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#e6008a] text-white font-bold rounded-xl text-sm"
          >
            <Calendar className="w-4 h-4" />
            Book Free Call
            <ArrowRight className="w-4 h-4" />
          </button>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFF5F9] to-white">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff0099]" />
      </div>
    }>
      <LetsTalkContent />
    </Suspense>
  );
}
