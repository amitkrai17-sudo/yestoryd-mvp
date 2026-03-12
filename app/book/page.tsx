'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';

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
        <Spinner size="xl" className="mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to enrollment...</p>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Spinner size="xl" />
      </div>
    }>
      <BookRedirect />
    </Suspense>
  );
}
