'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function BookRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Preserve all URL parameters when redirecting
    const params = searchParams.toString();
    const redirectUrl = params ? `/enroll?${params}` : '/enroll';
    router.replace(redirectUrl);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to enrollment...</p>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
      </div>
    }>
      <BookRedirect />
    </Suspense>
  );
}