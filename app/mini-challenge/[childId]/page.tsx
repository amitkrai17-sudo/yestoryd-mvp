// ============================================================
// FILE: app/mini-challenge/[childId]/page.tsx
// ============================================================
// Mini Challenge page
// URL: /mini-challenge/{childId}?goal=reading
// ============================================================

import { MiniChallengeFlow } from '@/components/mini-challenge';

interface PageProps {
  params: { childId: string };
  searchParams: { goal?: string };
}

export default function MiniChallengePage({ params, searchParams }: PageProps) {
  return (
    <main className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <MiniChallengeFlow
          childId={params.childId}
          goalArea={searchParams.goal}
        />
      </div>
    </main>
  );
}
