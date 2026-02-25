// =============================================================================
// FILE: app/classes/activity/[sessionId]/page.tsx
// PURPOSE: Server component for parent activity page
// =============================================================================

import { Metadata } from 'next';
import ActivityClient from './ActivityClient';

export const metadata: Metadata = {
  title: 'Class Activity | Yestoryd',
  description: 'Submit your response for the group class activity',
};

export default function ActivityPage() {
  return <ActivityClient />;
}
