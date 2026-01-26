// =============================================================================
// SERVER COMPONENT: Assessment Page Entry Point
// Enterprise Architecture: Server-side data fetch + Client component hydration
// =============================================================================

import { getAssessmentSettings } from '@/lib/settings';
import AssessmentPageClient from './AssessmentPageClient';

// Revalidate settings every hour (ISR)
export const revalidate = 3600;

export default async function AssessmentPage() {
  const settings = await getAssessmentSettings();

  return <AssessmentPageClient settings={settings} />;
}
