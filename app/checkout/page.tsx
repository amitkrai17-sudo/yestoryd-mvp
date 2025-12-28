// =============================================================================
// FILE: app/checkout/page.tsx
// PURPOSE: Redirect to unified /enroll page (preserves URL params)
// =============================================================================

import { redirect } from 'next/navigation';

interface CheckoutPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  
  // Build query string from all params
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`;
    })
    .join('&');

  // Redirect to /enroll with all params preserved
  const redirectUrl = queryString ? `/enroll?${queryString}&source=checkout` : '/enroll?source=checkout';
  
  redirect(redirectUrl);
}
