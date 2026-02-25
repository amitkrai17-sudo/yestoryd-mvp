// =============================================================================
// FILE: app/admin/group-classes/blueprints/page.tsx
// PURPOSE: Server component for admin blueprint management
// =============================================================================

import { Metadata } from 'next';
import BlueprintListClient from './BlueprintListClient';

export const metadata: Metadata = {
  title: 'Blueprints | Group Classes | Admin | Yestoryd',
  description: 'Manage group class blueprints',
};

export default function BlueprintsPage() {
  return <BlueprintListClient />;
}
