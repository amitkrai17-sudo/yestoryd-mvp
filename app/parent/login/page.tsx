'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle, MessageCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { useHashSessionRedirect } from '@/hooks/useHashSessionRedirect';

const SUPPORT_WHATSAPP = COMPANY_CONFIG.leadBotWhatsApp;

export default function ParentLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'phone' | 'phone-otp'>('login');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const unauthorizedError = errorParam === 'unauthorized';
  const linkExpiredError = errorParam === 'link_expired';

  // WhatsApp OTP states
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [actualOtpMethod, setActualOtpMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle Supabase implicit flow hash fragment (middleware redirect preserves #access_token)
  const { isProcessingHash } = useHashSessionRedirect('/parent/dashboard', { setError, setCheckingSession });

  // ─── Auth state management ───
  useEffect(() => {
    // If the hash session hook is handling redirect, skip normal auth setup
    if (isProcessingHash.current) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isProcessingHash.current) return;
      if (event === 'SIGNED_IN' && session && !unauthorizedError) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          window.location.href = '/parent/dashboard';
        } else {
          await supabase.auth.signOut();
          setCheckingSession(false);
        }
      }
      if (event === 'SIGNED_OUT') {
        setCheckingSession(false);
      }
    });

    supabase.auth.getUser().then(async ({ data: { user }, error: userError }) => {
      if (linkExpiredError) {
        setError('This login link has expired. Please request a new one.');
        setCheckingSession(false);
      } else if (user && unauthorizedError) {
        await supabase.auth.signOut();
        setError('Your account is not registered as a parent. Please take a free assessment first or contact support.');
        setCheckingSession(false);
      } else if (user && !userError) {
        window.location.href = '/parent/dashboard';
      } else {
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchVideoUrl() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'parent_login_video_url')
          .single();
        if (data?.value) {
          const parsed = JSON.parse(String(data.value));
          if (parsed && parsed.startsWith('http')) setVideoUrl(parsed);
        }
      } catch { /* no video configured */ }
    }
    fetchVideoUrl();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (mode === 'phone-otp' && otp.every(d => d !== '') && !otpLoading) {
      verifyOtp();
    }
  }, [otp, mode]);

  // ─── Auth handlers (ALL PRESERVED) ───
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/parent/dashboard` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data: parent } = await supabase
        .from('parents').select('id').eq('email', email.toLowerCase().trim()).single();
      if (!parent) {
        const { data: child } = await supabase
          .from('children').select('id').eq('parent_email', email.toLowerCase().trim()).limit(1).single();
        if (!child) {
          setError('This email is not registered. Please take a free assessment first.');
          setLoading(false);
          return;
        }
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/parent/dashboard` },
      });
      if (error) throw error;
      setMessage('Magic link sent! Check your email to sign in.');
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  // ─── WhatsApp OTP handlers (ALL PRESERVED) ───
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
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length; i++) newOtp[i] = pasteData[i];
    setOtp(newOtp);
    otpRefs.current[Math.min(pasteData.length, 5)]?.focus();
  };

  async function sendWhatsAppOtp() {
    if (phone.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setOtpLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${countryCode.replace("+", "")}${phone}`, method: 'whatsapp', userType: 'parent' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.code === 'PHONE_NOT_FOUND'
          ? 'This number is not registered. Please take a free assessment first.'
          : (data.error || 'Failed to send OTP'));
        return;
      }
      setMode('phone-otp');
      setCountdown(300);
      setOtp(['', '', '', '', '', '']);
      setActualOtpMethod(data.method || 'whatsapp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    const otpString = otp.join('');
    if (otpString.length !== 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setOtpLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `${countryCode.replace("+", "")}${phone}`, otp: otpString, userType: 'parent' }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Invalid OTP'); return; }

      if (data.session) {
        // Guard: prevent onAuthStateChange from racing with this redirect
        isProcessingHash.current = true;
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionErr) {
          isProcessingHash.current = false;
          setError('Failed to establish session. Please try again.');
          return;
        }
        // Hard navigation so middleware re-evaluates the new session cookie
        window.location.href = data.redirectTo || '/parent/dashboard';
        return;
      }

      // actionLink fallback — server-side token exchange failed
      if (data.actionLink) {
        window.location.href = data.actionLink;
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  // ─── Shared UI pieces ───
  const ErrorBanner = () => error ? (
    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
      {error}
    </div>
  ) : null;

  const SuccessBanner = () => message ? (
    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
      {message}
    </div>
  ) : null;

  // ─── RENDER: Loading ───
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#FF0099] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── RENDER: OTP Verification ───
  if (mode === 'phone-otp') {
    return (
      <div className="min-h-screen bg-[#0f1419] flex flex-col">
        {/* Top */}
        <div className="flex flex-col items-center px-4 pt-8 pb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            actualOtpMethod === 'whatsapp' ? 'bg-[#1D9E75]' : 'bg-[#FF0099]'
          }`}>
            {actualOtpMethod === 'whatsapp'
              ? <MessageCircle className="w-6 h-6 text-white" />
              : <Mail className="w-6 h-6 text-white" />
            }
          </div>
          <h1 className="text-xl font-medium text-white">Enter OTP</h1>
          <p className="text-sm text-gray-400 mt-1">
            Code sent to your {actualOtpMethod === 'whatsapp' ? 'WhatsApp' : 'email'}
          </p>
          <p className="text-sm text-[#FF0099] font-medium mt-0.5">{countryCode} {formatPhoneDisplay(phone)}</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a2028] rounded-t-2xl px-5 py-6 sm:px-8 sm:py-8 max-w-md w-full mx-auto mt-auto">
          <ErrorBanner />

          <div className="flex justify-center gap-2 mb-5" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-medium text-white bg-[#0f1419] border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#FF0099] focus:border-transparent outline-none transition-all"
                maxLength={1}
              />
            ))}
          </div>

          {countdown > 0 && (
            <p className="text-center text-xs text-gray-500 mb-4">
              Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
            </p>
          )}

          <button
            onClick={verifyOtp}
            disabled={otpLoading || otp.some(d => d === '')}
            className="w-full py-3.5 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#cc007a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
          >
            {otpLoading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>Verify & Login <ArrowRight className="w-4 h-4" /></>
            }
          </button>

          <div className="mt-4 text-center">
            {countdown === 0 ? (
              <button onClick={sendWhatsAppOtp} disabled={otpLoading} className="text-sm text-[#FF0099] font-medium">
                Resend OTP
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                Didn&apos;t receive? Wait {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </p>
            )}
          </div>

          <button
            onClick={() => { setMode('phone'); setOtp(['', '', '', '', '', '']); setError(''); }}
            className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm text-center min-h-[44px]"
          >
            Change phone number
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: Phone Input ───
  if (mode === 'phone') {
    return (
      <div className="min-h-screen bg-[#0f1419] flex flex-col">
        <div className="flex flex-col items-center px-4 pt-8 pb-4">
          <div className="w-12 h-12 bg-[#1D9E75] rounded-xl flex items-center justify-center mb-4">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-medium text-white">WhatsApp Login</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your registered mobile number</p>
        </div>

        <div className="bg-[#1a2028] rounded-t-2xl px-5 py-6 sm:px-8 sm:py-8 max-w-md w-full mx-auto mt-auto">
          <ErrorBanner />

          <label className="block text-sm text-gray-400 mb-2">Mobile Number</label>
          <div className="flex w-full mb-4">
            <input
              type="text"
              value={countryCode}
              onChange={(e) => {
                let val = e.target.value;
                if (!val.startsWith('+')) val = '+' + val.replace(/\D/g, '');
                else val = '+' + val.slice(1).replace(/\D/g, '');
                if (val.length <= 5) setCountryCode(val || '+');
              }}
              className="w-[60px] px-1.5 py-3.5 rounded-l-xl border border-r-0 border-gray-700 bg-[#0f1419] text-white text-center text-sm font-medium focus:ring-2 focus:ring-[#FF0099] outline-none"
            />
            <input
              type="tel"
              value={formatPhoneDisplay(phone)}
              onChange={handlePhoneChange}
              placeholder="98765 43210"
              className="flex-1 min-w-0 px-4 py-3.5 text-lg text-white bg-[#0f1419] border border-gray-700 rounded-r-xl focus:ring-2 focus:ring-[#FF0099] focus:border-transparent outline-none placeholder:text-gray-600"
              maxLength={11}
              autoFocus
            />
          </div>

          <button
            onClick={sendWhatsAppOtp}
            disabled={otpLoading || phone.length !== 10}
            className="w-full py-3.5 bg-[#1D9E75] text-white rounded-xl font-medium hover:bg-[#178a65] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
          >
            {otpLoading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><MessageCircle className="w-5 h-5" /> Send OTP via WhatsApp</>
            }
          </button>

          <button
            onClick={() => { setMode('login'); setError(''); }}
            className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm text-center min-h-[44px]"
          >
            Back to login options
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: Main Login Page ───
  return (
    <div className="min-h-screen bg-[#0f1419] grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8">
      {/* ── Desktop Left Panel ── */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/">
            <Image src="/images/logo.png" alt="Yestoryd" width={160} height={44} className="h-10 w-auto" />
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="max-w-md">
            {videoUrl && (
              <div className="mb-8">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-800">
                  <iframe
                    src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}rel=0&modestbranding=1`}
                    title="Welcome to Yestoryd"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            )}

            {/* Meet rAI card */}
            <div className="bg-white/5 border border-gray-800 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#FF0099] flex items-center justify-center">
                  <Image src="/images/rai-mascot.png" alt="rAI" width={32} height={32} className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Meet rAI</h2>
                  <p className="text-sm text-[#FF0099]">Your Reading Intelligence Analyst</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                rAI analyzes your child&apos;s reading in real-time, identifies areas for improvement,
                and provides personalized recommendations.
              </p>
              <div className="space-y-2">
                {['AI-powered reading assessment', 'Personalized learning path', 'Real-time progress tracking'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-[#FF0099] flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: '100+', label: 'Families' },
                { value: '4.9\u2605', label: 'Rating' },
                { value: '2x', label: 'Progress' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-medium text-[#FF0099]">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 text-gray-600 text-xs">
          &copy; 2025 Yestoryd. All rights reserved.
        </div>
      </div>

      {/* ── Login Form (mobile: full width, desktop: right half centered) ── */}
      <div className="flex flex-col items-center justify-center px-4 md:py-12">
        {/* Logo (mobile only) */}
        <Link href="/" className="md:hidden mt-8 mb-4">
          <Image src="/images/logo.png" alt="Yestoryd" width={140} height={38} className="h-9 w-auto" />
        </Link>

        {/* Heading */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-medium text-white">Welcome back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your parent dashboard</p>
        </div>

        {/* Login card */}
        <div className="bg-[#1a2028] rounded-2xl px-5 py-6 sm:px-8 sm:py-8 max-w-md w-full">
          <ErrorBanner />
          <SuccessBanner />

          {/* Primary: WhatsApp */}
          <button
            onClick={() => { setMode('phone'); setError(''); setMessage(''); }}
            className="w-full py-3.5 bg-[#1D9E75] text-white rounded-xl font-medium hover:bg-[#178a65] transition-colors flex items-center justify-center gap-2 mb-3 min-h-[48px]"
          >
            <MessageCircle className="w-5 h-5" />
            Continue with WhatsApp
          </button>

          {/* Secondary: Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3.5 bg-transparent border border-gray-700 text-white rounded-xl font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2 mb-4 min-h-[48px] disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
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

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">or use email</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Email input */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@email.com"
            className="w-full px-4 py-3.5 bg-[#0f1419] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#FF0099] focus:border-transparent outline-none transition-all mb-3"
          />

          {/* Magic Link — muted pink filled */}
          <button
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="w-full py-3.5 bg-[#FF0099]/80 text-white rounded-xl font-medium hover:bg-[#FF0099]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>Send magic link <Mail className="w-4 h-4" /></>
            }
          </button>

          {/* Separator */}
          <div className="my-5 h-px bg-gray-700" />

          {/* New parent section */}
          <p className="text-center text-xs text-gray-500 mb-3">New to Yestoryd?</p>
          <Link
            href="/assessment"
            className="w-full py-3.5 bg-[#FF0099]/80 text-white rounded-xl font-medium hover:bg-[#FF0099]/90 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
          >
            <Sparkles className="w-4 h-4" />
            Take a free reading test
          </Link>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-5">
            Need help?{' '}
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1D9E75] underline"
            >
              WhatsApp us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
