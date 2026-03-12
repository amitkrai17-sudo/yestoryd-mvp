// =============================================================================
// FILE: app/admin/books/page.tsx
// PURPOSE: Server component for admin book library management
// =============================================================================

import { Metadata } from 'next';
import AdminBooksClient from './AdminBooksClient';

export const metadata: Metadata = {
  title: 'Books Library | Admin | Yestoryd',
  description: 'Manage the book catalog, collections, and bulk uploads',
};

export default function AdminBooksPage() {
  return <AdminBooksClient />;
}
