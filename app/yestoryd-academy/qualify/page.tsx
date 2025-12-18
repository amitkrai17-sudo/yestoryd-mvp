// app/yestoryd-academy/qualify/page.tsx
// Step 2 of 3: Self-Qualification Checklist + Resume Upload
'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  FileText,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Essential qualities - ALL must be checked
const ESSENTIAL_QUALITIES = [
  {
    id: 'patience',
    text: 'I can patiently explain the same thing multiple times without frustration'
  },
  {
    id: 'enjoy_children',
    text: 'I genuinely enjoy spending time with children (ages 4-12)'
  },
  {
    id: 'commitment',
    text: 'I can commit at least 15-20 hours per month to coaching'
  },
  {
    id: 'tech_comfort',
    text: "I'm comfortable with video calls and basic technology"
  },
  {
    id: 'feedback',
    text: "I'm open to feedback and continuously improving"
  },
  {
    id: 'honesty',
    text: 'I believe in honest communication, even when it\'s difficult'
  }
];

// Bonus qualities - optional
const BONUS_QUALITIES = [
  {
    id: 'phonics',
    text: 'I have phonics training (Jolly Phonics, Cambridge, etc.)'
  },
  {
    id: 'teaching_exp',
    text: 'I have teaching or tutoring experience'
  },
  {
    id: 'parent_exp',
    text: 'I have experience with children (as parent/caregiver)'
  }
];

function QualifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  
  const [essentialChecked, setEssentialChecked] = useState<Set<string>>(new Set());
  const [bonusChecked, setBonusChecked] = useState<Set<string>>(new Set());
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load application data
  useEffect(() => {
    const loadApplication = async () => {
      if (!applicationId) {
        router.push('/yestoryd-academy/apply');
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('coach_applications')
          .select('*')
          .eq('id', applicationId)
          .single();

        if (fetchError || !data) {
          console.error('Application not found:', fetchError);
          setError('Application not found. Please start over.');
          setIsLoading(false);
          return;
        }

        setApplicationData(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading application:', err);
        setError('Failed to load application.');
        setIsLoading(false);
      }
    };

    loadApplication();
  }, [applicationId, router, supabase]);

  const toggleEssential = (id: string) => {
    const newSet = new Set(essentialChecked);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setEssentialChecked(newSet);
  };

  const toggleBonus = (id: string) => {
    const newSet = new Set(bonusChecked);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setBonusChecked(newSet);
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or Word document');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setResumeFile(file);
    setError(null);
  };

  const allEssentialChecked = essentialChecked.size === ESSENTIAL_QUALITIES.length;

  const handleContinue = async () => {
    if (!allEssentialChecked) {
      setError('Please check all essential qualities to continue. These are essential for success as a Yestoryd coach.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let resumeUrl = null;

      // Upload resume if provided
      if (resumeFile && applicationId) {
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${applicationId}-resume.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('coach-applications')
          .upload(filePath, resumeFile, { upsert: true });

        if (uploadError) {
          console.error('Resume upload error:', uploadError);
          // Continue anyway - resume is optional
        } else {
          const { data: urlData } = supabase.storage
            .from('coach-applications')
            .getPublicUrl(filePath);
          resumeUrl = urlData.publicUrl;
        }
      }

      // Update application
      const { error: updateError } = await supabase
        .from('coach_applications')
        .update({
          qualification_checklist: {
            essential: Array.from(essentialChecked),
            bonus: Array.from(bonusChecked)
          },
          resume_url: resumeUrl,
          status: 'qualified',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', applicationId);

      if (updateError) {
        console.error('Update error:', updateError);
        // Continue anyway
      }

      // Navigate to Step 3 (Assessment)
      router.push(`/yestoryd-academy/assessment?applicationId=${applicationId}`);

    } catch (err: any) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
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

  if (error && !applicationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/yestoryd-academy/apply"
            className="inline-flex items-center gap-2 bg-[#ff0099] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#e6008a] transition-colors"
          >
            Start Over
          </Link>
        </div>
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
          <span className="text-sm text-slate-500">Step 2 of 3</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className="h-full w-2/3 bg-gradient-to-r from-[#ff0099] to-[#7b008b]" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 py-8 md:py-12">
        {/* Welcome */}
        {applicationData && (
          <div className="bg-white rounded-xl p-4 mb-6 border border-slate-200">
            <p className="text-slate-600">
              Welcome, <span className="font-semibold text-slate-900">{applicationData.name}</span>!
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Quick Self-Assessment
          </h1>
          <p className="text-slate-600 mb-8">
            Let's make sure we're a good match for each other.
          </p>

          {/* Essential Qualities */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Essential Qualities</h2>
              <span className="text-sm text-slate-500">
                {essentialChecked.size}/{ESSENTIAL_QUALITIES.length} checked
              </span>
            </div>

            <div className="space-y-3">
              {ESSENTIAL_QUALITIES.map((item) => {
                const isChecked = essentialChecked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleEssential(item.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isChecked
                        ? 'border-[#ff0099] bg-pink-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isChecked
                        ? 'border-[#ff0099] bg-[#ff0099]'
                        : 'border-slate-300'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className={isChecked ? 'text-slate-900' : 'text-slate-600'}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {!allEssentialChecked && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Please check all items above to continue. These are essential for success as a Yestoryd coach.
                </p>
              </div>
            )}
          </div>

          {/* Bonus Qualities */}
          <div className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-4">Bonus (Optional)</h2>
            <div className="space-y-3">
              {BONUS_QUALITIES.map((item) => {
                const isChecked = bonusChecked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleBonus(item.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isChecked
                        ? 'border-[#00abff] bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isChecked
                        ? 'border-[#00abff] bg-[#00abff]'
                        : 'border-slate-300'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className={isChecked ? 'text-slate-900' : 'text-slate-600'}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resume Upload */}
          <div className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">Resume (Optional)</h2>
            <p className="text-sm text-slate-500 mb-4">
              Upload your resume if you have one. It helps us understand your background better.
            </p>

            {!resumeFile ? (
              <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-[#ff0099] hover:bg-pink-50 transition-colors">
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-slate-600">Click to upload PDF or Word doc</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-slate-900">{resumeFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(resumeFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setResumeFile(null)}
                  className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Link
              href={`/yestoryd-academy/apply`}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>

            <button
              onClick={handleContinue}
              disabled={!allEssentialChecked || isSubmitting}
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
        </div>
      </main>
    </div>
  );
}

export default function QualifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    }>
      <QualifyPageContent />
    </Suspense>
  );
}