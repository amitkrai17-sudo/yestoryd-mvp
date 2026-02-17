'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowRight, Users, CheckCircle, Wand2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function CoachLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'phone' | 'phone-otp'>('login');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('918976287997');
  const router = useRouter();

  // WhatsApp OTP states
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [actualOtpMethod, setActualOtpMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch video URL and WhatsApp number from site_settings
  useEffect(() => {
    async function fetchSiteSettings() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['coach_login_video_url', 'whatsapp_number']);

        if (data) {
          data.forEach((setting) => {
            if (setting.key === 'coach_login_video_url' && setting.value) {
              const parsed = JSON.parse(String(setting.value));
              if (parsed && typeof parsed === 'string' && parsed.startsWith('http')) {
                setVideoUrl(parsed);
              }
            }
            if (setting.key === 'whatsapp_number' && setting.value) {
              setWhatsappNumber(String(setting.value).replace('+', ''));
            }
          });
        }
      } catch (err) {
        console.log('Failed to fetch site settings');
      }
    }
    fetchSiteSettings();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/coach/dashboard');
        return;
      }
    };
    handleAuthCallback();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/coach/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-submit OTP when complete
  useEffect(() => {
    if (mode === 'phone-otp' && otp.every(d => d !== '') && !otpLoading) {
      verifyOtp();
    }
  }, [otp, mode]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/coach/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Check if email exists in coaches table
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .single();

      if (!coach) {
        setError('This email is not registered as a coach. Apply to join Yestoryd Academy first.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/coach/dashboard`,
        },
      });
      if (error) throw error;
      setMessage('Magic link sent! Check your email to sign in.');
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // WHATSAPP OTP FUNCTIONS
  // ─────────────────────────────────────────────────────────
  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setError('');
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);
    const focusIndex = Math.min(pasteData.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  async function sendWhatsAppOtp() {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${countryCode.replace("+", "")}${phone}`, method: 'whatsapp', userType: 'coach' }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'COACH_NOT_FOUND') {
          setError('This number is not registered as a coach. Apply to join Yestoryd Academy first.');
        } else {
          setError(data.error || 'Failed to send OTP');
        }
        return;
      }

      setMode('phone-otp');
      setCountdown(300);
      setOtp(['', '', '', '', '', '']);
      setActualOtpMethod(data.method || 'whatsapp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);

    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${countryCode.replace("+", "")}${phone}`, otp: otpString, userType: 'coach' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid OTP');
        return;
      }

      if (data.accessToken) {
        window.location.href = data.accessToken;
      } else {
        router.push('/coach/dashboard');
      }

    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: OTP VERIFICATION STEP
  // ─────────────────────────────────────────────────────────
  if (mode === 'phone-otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0a1628] to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-surface-1 rounded-3xl shadow-2xl p-8 lg:p-10 border border-border">
            <div className="text-center mb-8">
              <div className={`w-14 h-14 ${actualOtpMethod === 'whatsapp' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${actualOtpMethod === 'whatsapp' ? 'shadow-green-500/30' : 'shadow-blue-500/30'}`}>
                {actualOtpMethod === 'whatsapp' ? (
                  <MessageCircle className="w-7 h-7 text-white" />
                ) : (
                  <Mail className="w-7 h-7 text-white" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">Enter OTP</h1>
              <p className="text-text-tertiary mt-2">
                We sent a 6-digit code to your {actualOtpMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </p>
              <p className="text-[#00abff] font-medium mt-1">{countryCode} {formatPhoneDisplay(phone)}</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold text-white bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-[#00abff] focus:border-transparent outline-none transition-all"
                  maxLength={1}
                />
              ))}
            </div>

            {countdown > 0 && (
              <p className="text-center text-sm text-text-tertiary mb-4">
                Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </p>
            )}

            <button
              onClick={verifyOtp}
              disabled={otpLoading || otp.some(d => d === '')}
              className="w-full py-4 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:from-[#0099ee] hover:to-[#0055bb] transition-all shadow-lg shadow-[#00abff]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {otpLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Verify & Login
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="mt-6 text-center">
              {countdown === 0 ? (
                <button onClick={sendWhatsAppOtp} disabled={otpLoading} className="text-[#00abff] hover:text-[#0066cc] font-medium">
                  Resend OTP
                </button>
              ) : (
                <p className="text-text-tertiary text-sm">
                  Didn't receive? Wait {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')} to resend
                </p>
              )}
            </div>

            <button
              onClick={() => { setMode('phone'); setOtp(['', '', '', '', '', '']); setError(''); }}
              className="w-full mt-4 text-text-tertiary hover:text-text-secondary text-sm"
            >
              ← Change phone number
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: PHONE INPUT STEP
  // ─────────────────────────────────────────────────────────
  if (mode === 'phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0a1628] to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-surface-1 rounded-3xl shadow-2xl p-8 lg:p-10 border border-border">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">WhatsApp Login</h1>
              <p className="text-text-tertiary mt-2">Enter your registered mobile number</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-2">Mobile Number</label>
              <div className="flex">
                <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith('+')) val = '+' + val.replace(/\D/g, '');
                      else val = '+' + val.slice(1).replace(/\D/g, '');
                      if (val.length <= 5) setCountryCode(val || '+');
                    }}
                    className="w-[70px] px-2 py-3.5 rounded-l-xl border border-r-0 border-border bg-surface-2 text-text-secondary text-center text-sm font-medium focus:ring-2 focus:ring-[#00abff] outline-none"
                    placeholder="+91"
                  />
                <input
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                  placeholder="98765 43210"
                  className="flex-1 px-4 py-3.5 text-lg text-white bg-surface-2 border border-border rounded-r-xl focus:ring-2 focus:ring-[#00abff] focus:border-transparent outline-none"
                  maxLength={11}
                  autoFocus
                />
              </div>
            </div>

            <button
              onClick={sendWhatsAppOtp}
              disabled={otpLoading || phone.length !== 10}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {otpLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  Send OTP via WhatsApp
                </>
              )}
            </button>

            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="w-full mt-4 text-text-tertiary hover:text-text-secondary text-sm"
            >
              ← Back to login options
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: MAIN LOGIN PAGE
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0a1628] to-gray-900 flex">
      {/* Left Side - Branding & rAI */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#00abff] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#0066cc] rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00abff] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Image src="/images/logo.png" alt="Yestoryd" width={180} height={50} className="h-12 w-auto" />
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="max-w-md">
            {videoUrl && (
              <div className="mb-6">
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <iframe
                    src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
                    title="Welcome Coaches"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            )}

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00abff] to-[#0066cc] flex items-center justify-center shadow-lg shadow-[#00abff]/30 overflow-hidden">
                  <Image src="/images/rai-mascot.png" alt="rAI" width={48} height={48} className="w-12 h-12" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Coach with rAI</h2>
                  <p className="text-[#00abff]">Your AI-Powered Teaching Assistant</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                rAI helps you deliver personalized coaching by providing real-time insights
                about each child&apos;s reading progress, strengths, and areas for improvement.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>AI-powered student insights</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>Automated session scheduling</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>Earn while making a difference</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">10+</p>
                <p className="text-sm text-gray-400">Active Coaches</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">₹15K+</p>
                <p className="text-sm text-gray-400">Avg. Earnings</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">4.9★</p>
                <p className="text-sm text-gray-400">Coach Rating</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-gray-500 text-sm">
          © 2025 Yestoryd. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <Link href="/">
              <Image src="/images/logo.png" alt="Yestoryd" width={150} height={40} className="h-10 w-auto mx-auto" />
            </Link>
          </div>

          {videoUrl && (
            <div className="lg:hidden mb-6">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border border-white/10">
                <iframe
                  src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
                  title="Welcome Coaches"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          )}

          <div className="bg-surface-1 rounded-3xl shadow-2xl p-8 lg:p-10 border border-border">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-[#00abff] to-[#0066cc] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00abff]/30">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Coach Portal</h1>
              <p className="text-text-tertiary mt-2">Sign in to manage your students</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
                {message}
              </div>
            )}

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-3.5 bg-surface-2 border border-border rounded-xl font-medium text-text-secondary hover:bg-surface-3 transition-all flex items-center justify-center gap-3 mb-3 disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* WhatsApp OTP Button */}
            <button
              onClick={() => { setMode('phone'); setError(''); setMessage(''); }}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-medium text-white hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-3 mb-4 shadow-lg shadow-green-500/20"
            >
              <MessageCircle className="w-5 h-5" />
              Continue with WhatsApp
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-text-tertiary">or use email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Email + Magic Link */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coach@email.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-tertiary focus:ring-2 focus:ring-[#00abff] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="w-full py-4 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:from-[#0099ee] hover:to-[#0055bb] transition-all shadow-lg shadow-[#00abff]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Send Magic Link
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-text-tertiary">want to join?</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* rAI CTA (Mobile) */}
            <div className="lg:hidden mb-4">
              <div className="bg-surface-2 border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00abff] to-[#0066cc] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image src="/images/rai-mascot.png" alt="rAI" width={32} height={32} className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-white">Become a Coach</p>
                  <p className="text-sm text-text-tertiary">Join Yestoryd Academy today!</p>
                </div>
              </div>
            </div>

            {/* Apply as Coach CTA */}
            <Link
              href="/yestoryd-academy"
              className="w-full py-3.5 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Become a Coach
              <Image src="/images/rai-mascot.png" alt="rAI" width={24} height={24} className="w-6 h-6" />
            </Link>
          </div>

          <p className="text-center mt-6 text-gray-400 text-sm">
            Need help?{' '}
            <a href={`https://wa.me/${whatsappNumber}`} className="text-[#00abff] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
