'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowRight, BookOpen, CheckCircle, Wand2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ParentLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'magic'>('login');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const router = useRouter();

  // Fetch video URL from site_settings
  useEffect(() => {
    async function fetchVideoUrl() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'parent_login_video_url')
          .single();

        if (data?.value) {
          const parsed = JSON.parse(data.value);
          if (parsed && parsed.startsWith('http')) {
            setVideoUrl(parsed);
          }
        }
      } catch (err) {
        console.log('No video configured for parent login');
      }
    }
    fetchVideoUrl();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/parent/dashboard');
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Check your email for a confirmation link!');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/parent/reset-password`,
        });
        if (error) throw error;
        setMessage('Password reset link sent to your email!');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/parent/dashboard`,
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
      setError('Please enter your email first');
      return;
    }
    setMagicLinkLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/parent/dashboard`,
        },
      });
      if (error) throw error;
      setMessage('Magic link sent! Check your email to sign in.');
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setMagicLinkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0a1628] to-gray-900 flex">
      {/* Left Side - Branding & rAI */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#7b008b] rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00abff] rounded-full blur-3xl" />
        </div>

        {/* Yestoryd Logo */}
        <div className="relative z-10">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={180}
              height={50}
              className="h-12 w-auto"
            />
          </Link>
        </div>

        {/* rAI Introduction */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="max-w-md">
            {/* Video Section - Shows if video URL is configured */}
            {videoUrl && (
              <div className="mb-6">
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10">
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

            {/* rAI Card - FIXED: "Reading Analyst" not "Coach" */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center shadow-lg shadow-[#ff0099]/30 overflow-hidden">
                  <Image
                    src="/images/rai-mascot.png"
                    alt="rAI"
                    width={48}
                    height={48}
                    className="w-12 h-12"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Meet rAI</h2>
                  <p className="text-[#00abff]">Your Reading Intelligence Analyst</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                rAI analyzes your child&apos;s reading in real-time, identifies areas for improvement,
                and provides personalized recommendations for your certified coach.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>AI-powered reading assessment</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>Personalized learning path</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-[#00abff]" />
                  <span>Real-time progress tracking</span>
                </div>
              </div>
            </div>

            {/* Stats - FIXED: "100+ Families" for consistency */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">100+</p>
                <p className="text-sm text-gray-400">Families Helped</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">4.9★</p>
                <p className="text-sm text-gray-400">Parent Rating</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">2x</p>
                <p className="text-sm text-gray-400">Faster Progress</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - FIXED: Encoding */}
        <div className="relative z-10 text-gray-500 text-sm">
          © 2025 Yestoryd. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <Link href="/">
              <Image
                src="/images/logo.png"
                alt="Yestoryd"
                width={150}
                height={40}
                className="h-10 w-auto mx-auto"
              />
            </Link>
          </div>

          {/* Mobile Video Section */}
          {videoUrl && (
            <div className="lg:hidden mb-6">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border border-white/10">
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

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-[#00abff] to-[#0066cc] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00abff]/30">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'login' ? 'Welcome Back!' : mode === 'signup' ? 'Create Account' : mode === 'magic' ? 'Magic Link' : 'Reset Password'}
              </h1>
              <p className="text-gray-500 mt-2">
                {mode === 'login'
                  ? 'Sign in to access your parent dashboard'
                  : mode === 'signup'
                    ? "Start your child's reading journey"
                    : mode === 'magic'
                      ? 'Sign in without a password'
                      : 'Enter your email to reset password'}
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                {message}
              </div>
            )}

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-3.5 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 mb-4 disabled:opacity-50"
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
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@email.com"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#00abff] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {(mode === 'login' || mode === 'signup') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#00abff] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex justify-between items-center text-sm">
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={magicLinkLoading}
                    className="text-[#7b008b] hover:text-[#6a0078] font-medium flex items-center gap-1"
                  >
                    {magicLinkLoading ? (
                      <div className="w-4 h-4 border-2 border-[#7b008b] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    Send Magic Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[#00abff] hover:text-[#0066cc] font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#00abff] to-[#0066cc] text-white rounded-xl font-semibold hover:from-[#0099ee] hover:to-[#0055bb] transition-all shadow-lg shadow-[#00abff]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              {mode === 'login' ? (
                <p className="text-gray-600">
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                    className="text-[#00abff] hover:text-[#0066cc] font-semibold"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                    className="text-[#00abff] hover:text-[#0066cc] font-semibold"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">new to Yestoryd?</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* rAI CTA (Mobile) */}
            <div className="lg:hidden mb-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image
                    src="/images/rai-mascot.png"
                    alt="rAI"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">New here?</p>
                  <p className="text-sm text-gray-500">Take a free assessment first!</p>
                </div>
              </div>
            </div>

            {/* Take Assessment CTA */}
            <Link
              href="/assessment"
              className="w-full py-3.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Free Assessment
              <Image
                src="/images/rai-mascot.png"
                alt="rAI"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </Link>
          </div>

          {/* Help Link */}
          <p className="text-center mt-6 text-gray-400 text-sm">
            Need help?{' '}
            <a href="https://wa.me/918976287997" className="text-[#00abff] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
