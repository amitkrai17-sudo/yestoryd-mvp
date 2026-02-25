// =============================================================================
// FILE: app/admin/group-classes/blueprints/[id]/page.tsx
// PURPOSE: Server component for blueprint editor (create/edit)
// =============================================================================

import { Metadata } from 'next';
import BlueprintEditorClient from './BlueprintEditorClient';

export const metadata: Metadata = {
  title: 'Edit Blueprint | Admin | Yestoryd',
  description: 'Create or edit a group class blueprint',
};

export default function BlueprintEditorPage() {
  return <BlueprintEditorClient />;
}
