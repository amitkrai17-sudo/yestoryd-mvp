'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle,
  ArrowRight,
  Loader2,
  Shield,
  Star,
  Calendar,
  BookOpen,
  MessageCircle,
  Video,
  Sparkles,
  Award,
  Phone,
  Mail,
  User,
  Baby,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function EnrollContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Pre-fill from URL params
  const [formData, setFormData] = useState({
    parentName: searchParams.get('parentName') || '',
    parentEmail: searchParams.get('parentEmail') || '',
    parentPhone: searchParams.get('parentPhone') || '',
    childName: searchParams.get('childName') || '',
    childAge: searchParams.get('childAge') || '',
  });

  const source = searchParams.get('source') || 'direct';

  // WhatsApp
  const whatsappNumber = '918976287997';
  const whatsappMessage = encodeURIComponent(
    `Hi! I'd like to enroll${formData.childName ? ` ${formData.childName}` : ' my child'} in Yestoryd's reading program.`
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!razorpayLoaded) {
      setError('Payment system is loading. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create Razorpay order
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 5999,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          childName: formData.childName,
          childAge: formData.childAge,
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: 'INR',
        name: 'Yestoryd',
        description: '3-Month Reading Coaching Program',
        order_id: data.orderId,
        prefill: {
          name: formData.parentName,
          email: formData.parentEmail,
          contact: formData.parentPhone,
        },
        theme: {
          color: '#ff0099',
        },
        handler: async function (response: any) {
          // Verify payment
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                childName: formData.childName,
                childAge: formData.childAge,
                parentEmail: formData.parentEmail,
                parentPhone: formData.parentPhone,
                parentName: formData.parentName,
              }),
            });

            if (verifyRes.ok) {
              window.location.href = '/enrollment-success';
            } else {
              setError('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            setError('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Video, text: '6 One-on-One Sessions' },
    { icon: Calendar, text: '3 Parent Meetings' },
    { icon: BookOpen, text: 'FREE E-Learning' },
    { icon: Sparkles, text: 'AI Progress Tracking' },
    { icon: MessageCircle, text: 'WhatsApp Support' },
    { icon: Award, text: 'Certificate' },
  ];

  // Personalized CTA - returns JSX for styled name
  const renderCtaText = () => {
    if (formData.childName) {
      return (
        <>
          Enroll <span className="text-yellow-300 font-black underline underline-offset-2">{formData.childName}</span> — ₹5,999
        </>
      );
    }
    return 'Proceed to Payment — ₹5,999';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
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
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Book Free Call</span>
            <span className="sm:hidden">Free Call</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-10">
          
          {/* Left Column - Info (2/5) */}
          <div className="lg:col-span-2">
            {/* Coach Card */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
              <div className="flex items-center gap-2 text-yellow-600 mb-3">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold text-xs">YOUR READING COACH</span>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold">
                  R
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Rucha</h3>
                  <p className="text-green-600 font-medium text-sm">Founder & Lead Coach</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">4.9</span>
                </div>
                <span>10+ years exp.</span>
                <span>500+ students</span>
              </div>
            </div>

            {/* What's Included */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3 text-sm">
                <BookOpen className="w-4 h-4 text-gray-600" />
                What's Included
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 hidden lg:block">
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <p className="text-gray-700 italic text-sm mb-3">
                "Amazing transformation! Aarav went from struggling to reading confidently."
              </p>
              <p className="font-bold text-green-700 text-sm">— Priya S., Mumbai</p>
            </div>
          </div>

          {/* Right Column - Form (3/5) */}
          <div className="lg:col-span-3">
            {/* Pricing Card */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">3-Month Reading Coaching</h2>
                    <p className="text-white/80 text-xs">9 sessions. Everything included.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs line-through text-white/60">₹11,999</div>
                    <div className="text-2xl font-black">₹5,999</div>
                  </div>
                </div>
                <div className="mt-2 inline-block bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full text-xs font-bold">
                  SAVE 50%
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                {/* Parent Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                </div>

                {/* Email & Phone Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="parentEmail"
                        value={formData.parentEmail}
                        onChange={handleInputChange}
                        required
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="parentPhone"
                        value={formData.parentPhone}
                        onChange={handleInputChange}
                        required
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Child Name & Age Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Child's Name *</label>
                    <div className="relative">
                      <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="childName"
                        value={formData.childName}
                        onChange={handleInputChange}
                        required
                        placeholder="Child's name"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Age *</label>
                    <select
                      name="childAge"
                      value={formData.childAge}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    >
                      <option value="">Select age</option>
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                        <option key={age} value={age}>{age} years</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !razorpayLoaded}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      {renderCtaText()}
                    </>
                  )}
                </button>

                {/* Trust Signals */}
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 pt-2">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-500" />
                    100% Refund Guarantee
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    Flexible scheduling
                  </span>
                </div>
              </form>

              {/* Alternative */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <p className="text-center text-gray-600 text-xs mb-2">
                  Need help deciding?
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/lets-talk"
                    className="flex-1 h-10 flex items-center justify-center gap-1 bg-purple-100 text-purple-700 font-semibold rounded-lg text-sm hover:bg-purple-200 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Free Call
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-10 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
      </div>
    }>
      <EnrollContent />
    </Suspense>
  );
}