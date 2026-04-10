// =============================================================================
// FILE: app/admin/group-classes/page.tsx
// PURPOSE: Server component for admin group classes management
// =============================================================================

import { Metadata } from 'next';
import AdminGroupClassesClient from './AdminGroupClassesClient';

export const metadata: Metadata = {
  title: 'Workshops | Admin | Yestoryd',
  description: 'Manage workshop sessions',
};

export default function AdminGroupClassesPage() {
  return <AdminGroupClassesClient />;
}
