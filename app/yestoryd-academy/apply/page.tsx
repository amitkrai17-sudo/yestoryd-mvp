// app/yestoryd-academy/apply/page.tsx
// Step 1 of 3: Basic Information + Google Sign-in
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowRight,
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Loader2,
  CheckCircle2
} from 'lucide-react';

// Country list
const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'UAE' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'OTHER', name: 'Other' }
];

// Indian cities for dropdown
const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Surat', 'Kanpur',
  'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna',
  'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
  'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Chandigarh', 'Coimbatore',
  'Other'
];

export default function ApplyPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    customCity: ''
  });

  // Check for existing session
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setFormData(prev => ({
          ...prev,
          email: user.email || '',
          name: user.user_metadata?.full_name || prev.name
        }));
      }
      setIsLoading(false);
    };
    checkUser();

    // Listen for auth changes (after Google redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setFormData(prev => ({
          ...prev,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || prev.name
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/yestoryd-academy/apply`
      }
    });
    if (error) {
      console.error('Google sign in error:', error);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) return false;
    if (!formData.email.trim()) return false;
    if (!formData.phone.trim()) return false;
    if (!formData.country) return false;
    
    // City validation
    if (formData.country === 'IN') {
      if (!formData.city) return false;
      if (formData.city === 'Other' && !formData.customCity.trim()) return false;
    } else {
      if (!formData.customCity.trim()) return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine final city value
      const finalCity = formData.country === 'IN' 
        ? (formData.city === 'Other' ? formData.customCity : formData.city)
        : formData.customCity;

      // Create application record
      const { data: application, error: insertError } = await (supabase
        .from('coach_applications') as any)
        .insert({
          google_id: user?.id || null,
          email: formData.email.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          country: formData.country,
          city: finalCity,
          status: 'started'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!application) throw new Error('Failed to create application');

      // Navigate to Step 2
      router.push(`/yestoryd-academy/qualify?applicationId=${application.id}`);

    } catch (err: any) {
      console.error('Error creating application:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/yestoryd-academy">
            <Image 
              src="/images/logo.png" 
              alt="Yestoryd" 
              width={120} 
              height={35}
              className="h-8 w-auto"
            />
          </Link>
          <span className="text-sm text-slate-500">Step 1 of 3</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className="h-full w-1/3 bg-gradient-to-r from-[#ff0099] to-[#7b008b]" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Tell Us About Yourself
          </h1>
          <p className="text-slate-600 mb-8">
            Basic information to get started.
          </p>

          {/* Google Sign In */}
          {!user && (
            <>
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-slate-400">or fill manually</span>
                </div>
              </div>
            </>
          )}

          {/* Signed in indicator */}
          {user && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl mb-6">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700">Signed in as {user.email}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name <span className="text-[#ff0099]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email <span className="text-[#ff0099]">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all"
                  placeholder="your@email.com"
                  required
                  disabled={!!user}
                />
              </div>
              {user && (
                <p className="text-xs text-slate-500 mt-1">From your Google account</p>
              )}
            </div>

            {/* WhatsApp Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                WhatsApp Number <span className="text-[#ff0099]">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all"
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Country <span className="text-[#ff0099]">*</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value, city: '', customCity: ''})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all appearance-none bg-white"
                  required
                >
                  <option value="">Select your country</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* City - Dropdown for India, Text for others */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                City <span className="text-[#ff0099]">*</span>
              </label>
              {formData.country === 'IN' ? (
                <>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all appearance-none bg-white"
                      required
                    >
                      <option value="">Select your city</option>
                      {INDIAN_CITIES.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  {formData.city === 'Other' && (
                    <input
                      type="text"
                      value={formData.customCity}
                      onChange={(e) => setFormData({...formData, customCity: e.target.value})}
                      className="w-full mt-2 px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all"
                      placeholder="Enter your city"
                      required
                    />
                  )}
                </>
              ) : (
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.customCity}
                    onChange={(e) => setFormData({...formData, customCity: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:border-[#ff0099] focus:ring-1 focus:ring-[#ff0099] outline-none transition-all"
                    placeholder="Enter your city"
                    required={!!formData.country}
                  />
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 flex items-center justify-between">
              <Link
                href="/yestoryd-academy"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="flex items-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}