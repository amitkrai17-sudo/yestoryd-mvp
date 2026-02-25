// =============================================================================
// FILE: app/instructor/session/[sessionId]/page.tsx
// PURPOSE: Group Session Console — 4-state single-page app for live instruction
// States: PRE_SESSION → DURING_SESSION → INDIVIDUAL_MOMENT → POST_SESSION
// =============================================================================

import { Metadata } from 'next';
import SessionConsoleClient from './SessionConsoleClient';

export const metadata: Metadata = {
  title: 'Session Console | Instructor | Yestoryd',
  description: 'Live group session instructor console',
};

export default function SessionConsolePage() {
  return <SessionConsoleClient />;
}
