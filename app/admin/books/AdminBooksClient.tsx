// =============================================================================
// FILE: app/admin/books/AdminBooksClient.tsx
// PURPOSE: Admin UI for managing book catalog, collections, and bulk uploads
// PATTERN: Follows AdminGroupClassesClient.tsx structure
// =============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Upload, Download, BookOpen, Filter,
  Edit, Trash2, Eye, EyeOff, Star, X, Check,
  ChevronLeft, ChevronRight, FolderPlus, Library,
  FileSpreadsheet, AlertCircle, CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import SkillCategorySelect from '@/components/shared/SkillCategorySelect';
import * as Papa from 'papaparse';

// =============================================================================
// TYPES
// =============================================================================

interface Book {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  age_min: number | null;
  age_max: number | null;
  reading_level: string | null;
  genres: string[] | null;
  skills_targeted: string[] | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  vote_count: number | null;
  times_read_in_sessions: number | null;
  is_available_for_coaching: boolean | null;
  is_available_for_kahani_times: boolean | null;
  rucha_review: string | null;
  added_at: string | null;
}

interface BookDetail extends Book {
  illustrator: string | null;
  publisher: string | null;
  isbn: string | null;
  description: string | null;
  difficulty_score: number | null;
  themes: string[] | null;
  source_url: string | null;
  affiliate_url: string | null;
  buy_links: Record<string, string> | null;
  language: string | null;
  page_count: number | null;
  reading_time_minutes: number | null;
  vote_breakdown?: { kahani_request: number; want_to_read: number; favorite: number };
}

interface Collection {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  item_count: number;
  created_at: string;
}

interface BulkResult {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

type Tab = 'books' | 'collections' | 'upload';

const AGE_BANDS = [
  { label: 'Foundation (4-6)', min: 4, max: 6 },
  { label: 'Building (7-9)', min: 7, max: 9 },
  { label: 'Mastery (10-12)', min: 10, max: 12 },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function AdminBooksClient() {
  // ── State ──
  const [tab, setTab] = useState<Tab>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAgeBand, setFilterAgeBand] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Edit modal
  const [editBook, setEditBook] = useState<BookDetail | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', author: '', description: '', age_min: 4, age_max: 6,
    reading_level: '', illustrator: '', publisher: '', isbn: '',
    genres: '', themes: '', skills_targeted: [] as string[],
    rucha_review: '', affiliate_url: '', source_url: '',
    is_available_for_coaching: false, is_available_for_kahani_times: false,
  });
  const [createSaving, setCreateSaving] = useState(false);

  // Collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' });
  const [collectionSaving, setCollectionSaving] = useState(false);

  // Bulk upload
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Helpers ──
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Fetch books ──
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (filterActive) params.set('is_active', filterActive);
    if (filterLevel) params.set('reading_level', filterLevel);
    if (filterAgeBand) {
      const band = AGE_BANDS.find(b => b.label === filterAgeBand);
      if (band) {
        params.set('age_min', String(band.min));
        params.set('age_max', String(band.max));
      }
    }

    try {
      const res = await fetch(`/api/admin/books?${params}`);
      const data = await res.json();
      if (data.success) {
        setBooks(data.books);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        showToast(data.error || 'Failed to load books', 'error');
      }
    } catch {
      showToast('Failed to load books', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterAgeBand, filterLevel, filterActive, showToast]);

  useEffect(() => {
    if (tab === 'books') fetchBooks();
  }, [tab, fetchBooks]);

  // ── Fetch single book for edit ──
  const openEdit = async (bookId: string) => {
    setEditLoading(true);
    setEditBook(null);
    try {
      const res = await fetch(`/api/admin/books/${bookId}`);
      const data = await res.json();
      if (data.success) {
        setEditBook(data.book);
      } else {
        showToast('Failed to load book details', 'error');
      }
    } catch {
      showToast('Failed to load book details', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Save edit ──
  const saveEdit = async () => {
    if (!editBook) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/books/${editBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editBook.title,
          author: editBook.author,
          description: (editBook as BookDetail).description,
          reading_level: editBook.reading_level,
          age_min: editBook.age_min,
          age_max: editBook.age_max,
          rucha_review: editBook.rucha_review,
          affiliate_url: (editBook as BookDetail).affiliate_url,
          is_active: editBook.is_active,
          is_featured: editBook.is_featured,
          is_available_for_coaching: editBook.is_available_for_coaching,
          is_available_for_kahani_times: editBook.is_available_for_kahani_times,
          genres: editBook.genres,
          themes: (editBook as BookDetail).themes,
          skills_targeted: editBook.skills_targeted,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Book updated', 'success');
        setEditBook(null);
        fetchBooks();
      } else {
        showToast(data.error || 'Failed to update', 'error');
      }
    } catch {
      showToast('Failed to update', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Create book ──
  const handleCreate = async () => {
    if (!createForm.title || !createForm.author) {
      showToast('Title and author are required', 'error');
      return;
    }
    setCreateSaving(true);
    try {
      const res = await fetch('/api/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          genres: createForm.genres ? createForm.genres.split(',').map(s => s.trim()).filter(Boolean) : [],
          themes: createForm.themes ? createForm.themes.split(',').map(s => s.trim()).filter(Boolean) : [],
          skills_targeted: createForm.skills_targeted,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Book created', 'success');
        setShowCreate(false);
        setCreateForm({
          title: '', author: '', description: '', age_min: 4, age_max: 6,
          reading_level: '', illustrator: '', publisher: '', isbn: '',
          genres: '', themes: '', skills_targeted: [],
          rucha_review: '', affiliate_url: '', source_url: '',
          is_available_for_coaching: false, is_available_for_kahani_times: false,
        });
        fetchBooks();
      } else {
        showToast(data.error || 'Failed to create', 'error');
      }
    } catch {
      showToast('Failed to create book', 'error');
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Soft delete ──
  const handleDelete = async (bookId: string) => {
    if (!confirm('Deactivate this book?')) return;
    try {
      const res = await fetch(`/api/admin/books/${bookId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Book deactivated', 'success');
        fetchBooks();
      } else {
        showToast(data.error || 'Failed to deactivate', 'error');
      }
    } catch {
      showToast('Failed to deactivate', 'error');
    }
  };

  // ── Fetch collections ──
  const fetchCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const res = await fetch('/api/admin/books/collections');
      const data = await res.json();
      if (data.success) setCollections(data.collections);
    } catch {
      showToast('Failed to load collections', 'error');
    } finally {
      setCollectionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'collections') fetchCollections();
  }, [tab, fetchCollections]);

  // ── Create collection ──
  const handleCreateCollection = async () => {
    if (!collectionForm.name) return;
    setCollectionSaving(true);
    try {
      const res = await fetch('/api/admin/books/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Collection created', 'success');
        setShowCreateCollection(false);
        setCollectionForm({ name: '', description: '' });
        fetchCollections();
      } else {
        showToast(data.error || 'Failed to create', 'error');
      }
    } catch {
      showToast('Failed to create collection', 'error');
    } finally {
      setCollectionSaving(false);
    }
  };

  // ── CSV handling ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setUploadResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as Record<string, string>[]);
      },
      error: () => {
        showToast('Failed to parse CSV file', 'error');
      },
    });
  };

  const handleBulkUpload = async () => {
    if (csvData.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch('/api/admin/books/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: csvData }),
      });
      const data = await res.json();
      if (data.success !== undefined) {
        setUploadResult(data);
        if (data.inserted > 0) {
          showToast(`${data.inserted} books uploaded`, 'success');
        }
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Books Library</h1>
          <p className="text-sm text-gray-400 mt-1">{total} books in catalog</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-white text-[#0a0a0f] px-4 h-10 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Book
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
        {([
          { key: 'books' as Tab, label: 'All Books', icon: BookOpen },
          { key: 'collections' as Tab, label: 'Collections', icon: Library },
          { key: 'upload' as Tab, label: 'Bulk Upload', icon: Upload },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-[#0a0a0f]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── ALL BOOKS TAB ─── */}
      {tab === 'books' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search title or author..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 h-10 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              />
            </div>
            <select
              value={filterAgeBand}
              onChange={(e) => { setFilterAgeBand(e.target.value); setPage(1); }}
              className="h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none"
            >
              <option value="">All Ages</option>
              {AGE_BANDS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
            <select
              value={filterLevel}
              onChange={(e) => { setFilterLevel(e.target.value); setPage(1); }}
              className="h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none"
            >
              <option value="">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
            <select
              value={filterActive}
              onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
              className="h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" color="white" /></div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No books found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="pb-3 pl-3">Book</th>
                    <th className="pb-3">Age</th>
                    <th className="pb-3">Level</th>
                    <th className="pb-3">Skills</th>
                    <th className="pb-3 text-center">Votes</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {books.map(book => (
                    <tr key={book.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 pl-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {book.cover_image_url ? (
                              <img src={book.cover_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <BookOpen className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate max-w-[250px]">{book.title}</p>
                            <p className="text-gray-500 text-xs">{book.author}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-gray-300">{book.age_min}-{book.age_max}</td>
                      <td className="py-3 text-gray-300">{book.reading_level || '-'}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(book.skills_targeted || []).slice(0, 2).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">{s}</span>
                          ))}
                          {(book.skills_targeted || []).length > 2 && (
                            <span className="text-xs text-gray-500">+{(book.skills_targeted || []).length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-center text-gray-300">{book.vote_count || 0}</td>
                      <td className="py-3 text-center">
                        <StatusBadge status={book.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="py-3 text-right pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(book.id)}
                            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(book.id)}
                            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} books)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 h-9 rounded-xl text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 h-9 rounded-xl text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── COLLECTIONS TAB ─── */}
      {tab === 'collections' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateCollection(true)}
              className="flex items-center gap-2 bg-white text-[#0a0a0f] px-4 h-10 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <FolderPlus className="w-4 h-4" /> New Collection
            </button>
          </div>

          {collectionsLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" color="white" /></div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No collections yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map(col => (
                <div key={col.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 hover:border-gray-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {col.cover_image_url ? (
                        <img src={col.cover_image_url} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Library className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-medium truncate">{col.name}</h3>
                      {col.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{col.description}</p>
                      )}
                      <p className="text-gray-400 text-xs mt-2">{col.item_count} books</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Collection Modal */}
          {showCreateCollection && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">New Collection</h2>
                  <button onClick={() => setShowCreateCollection(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Collection name"
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={collectionForm.description}
                  onChange={(e) => setCollectionForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreateCollection(false)}
                    className="px-4 h-10 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCollection}
                    disabled={!collectionForm.name || collectionSaving}
                    className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium bg-white text-[#0a0a0f] hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    {collectionSaving && <Spinner size="sm" color="muted" />}
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── BULK UPLOAD TAB ─── */}
      {tab === 'upload' && (
        <div className="space-y-6">
          {/* Download template */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">CSV Template</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Download the template with required headers and 3 example rows
                </p>
                <a
                  href="/templates/book-upload-template.csv"
                  download
                  className="inline-flex items-center gap-2 mt-3 px-4 h-9 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Template
                </a>
              </div>
            </div>
          </div>

          {/* Upload zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-800/30 border-2 border-dashed border-gray-700 rounded-2xl p-12 text-center cursor-pointer hover:border-gray-500 transition-colors"
          >
            <Upload className="w-10 h-10 mx-auto text-gray-500 mb-3" />
            <p className="text-gray-300 text-sm font-medium">
              {csvFileName || 'Click to upload CSV file'}
            </p>
            <p className="text-gray-500 text-xs mt-1">Maximum 500 books per upload</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Preview */}
          {csvData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">{csvData.length}</span> books parsed from {csvFileName}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCsvData([]); setCsvFileName(''); setUploadResult(null); }}
                    className="px-4 h-9 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium bg-white text-[#0a0a0f] hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    {uploading && <Spinner size="sm" color="muted" />}
                    {uploading ? 'Uploading...' : 'Upload All'}
                  </button>
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Title</th>
                      <th className="pb-2 pr-4">Author</th>
                      <th className="pb-2 pr-4">Ages</th>
                      <th className="pb-2 pr-4">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {csvData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="text-gray-300">
                        <td className="py-1.5 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-1.5 pr-4 truncate max-w-[200px]">{row.title}</td>
                        <td className="py-1.5 pr-4">{row.author}</td>
                        <td className="py-1.5 pr-4">{row.age_min}-{row.age_max}</td>
                        <td className="py-1.5 pr-4">{row.reading_level || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 50 && (
                  <p className="text-xs text-gray-500 mt-2">Showing first 50 of {csvData.length} rows</p>
                )}
              </div>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-3">
              <h3 className="text-white font-medium">Upload Results</h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-emerald-400 font-medium">{uploadResult.inserted}</span>
                  <span className="text-gray-400 ml-1">inserted</span>
                </div>
                <div>
                  <span className="text-yellow-400 font-medium">{uploadResult.skipped}</span>
                  <span className="text-gray-400 ml-1">skipped (duplicates)</span>
                </div>
                <div>
                  <span className="text-red-400 font-medium">{uploadResult.errors.length}</span>
                  <span className="text-gray-400 ml-1">errors</span>
                </div>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {uploadResult.errors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-xs text-red-400">
                      Row {err.row}: {err.reason}
                    </p>
                  ))}
                  {uploadResult.errors.length > 20 && (
                    <p className="text-xs text-gray-500">...and {uploadResult.errors.length - 20} more errors</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── EDIT BOOK MODAL ─── */}
      {(editBook || editLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
          <div className="bg-gray-900 border-l border-gray-700 w-full max-w-lg h-full overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Book</h2>
              <button onClick={() => setEditBook(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" color="white" /></div>
            ) : editBook && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={editBook.title}
                    onChange={(e) => setEditBook({ ...editBook, title: e.target.value })}
                    className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Author</label>
                    <input
                      type="text"
                      value={editBook.author}
                      onChange={(e) => setEditBook({ ...editBook, author: e.target.value })}
                      className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Reading Level</label>
                    <select
                      value={editBook.reading_level || ''}
                      onChange={(e) => setEditBook({ ...editBook, reading_level: e.target.value || null })}
                      className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none"
                    >
                      <option value="">None</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Age Min</label>
                    <input
                      type="number"
                      value={editBook.age_min ?? ''}
                      onChange={(e) => setEditBook({ ...editBook, age_min: Number(e.target.value) })}
                      className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Age Max</label>
                    <input
                      type="number"
                      value={editBook.age_max ?? ''}
                      onChange={(e) => setEditBook({ ...editBook, age_max: Number(e.target.value) })}
                      className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <textarea
                    value={(editBook as BookDetail).description || ''}
                    onChange={(e) => setEditBook({ ...editBook, description: e.target.value } as BookDetail)}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rucha&apos;s Review</label>
                  <textarea
                    value={editBook.rucha_review || ''}
                    onChange={(e) => setEditBook({ ...editBook, rucha_review: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Affiliate URL</label>
                  <input
                    type="text"
                    value={(editBook as BookDetail).affiliate_url || ''}
                    onChange={(e) => setEditBook({ ...editBook, affiliate_url: e.target.value } as BookDetail)}
                    className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Skills Targeted</label>
                  <SkillCategorySelect
                    value={editBook.skills_targeted || []}
                    onChange={(v) => setEditBook({ ...editBook, skills_targeted: v as string[] } as BookDetail)}
                    multiple
                    context="admin"
                    placeholder="Select skills..."
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2">
                  {([
                    { key: 'is_active', label: 'Active' },
                    { key: 'is_featured', label: 'Featured' },
                    { key: 'is_available_for_coaching', label: 'Available for Coaching' },
                    { key: 'is_available_for_kahani_times', label: 'Available for Kahani Times' },
                  ] as const).map(toggle => (
                    <label key={toggle.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{toggle.label}</span>
                      <button
                        onClick={() => setEditBook({ ...editBook, [toggle.key]: !editBook[toggle.key] } as BookDetail)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          editBook[toggle.key] ? 'bg-emerald-500' : 'bg-gray-700'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          editBook[toggle.key] ? 'left-5' : 'left-1'
                        }`} />
                      </button>
                    </label>
                  ))}
                </div>

                {/* Vote stats */}
                {editBook.vote_breakdown && (
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-400 mb-2">Votes</p>
                    <div className="flex gap-4 text-sm">
                      <div><span className="text-white">{editBook.vote_breakdown.kahani_request}</span> <span className="text-gray-500">Kahani</span></div>
                      <div><span className="text-white">{editBook.vote_breakdown.want_to_read}</span> <span className="text-gray-500">Want to Read</span></div>
                      <div><span className="text-white">{editBook.vote_breakdown.favorite}</span> <span className="text-gray-500">Favorite</span></div>
                    </div>
                  </div>
                )}

                {/* Save */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => setEditBook(null)}
                    className="px-4 h-10 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium bg-white text-[#0a0a0f] hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    {editSaving && <Spinner size="sm" color="muted" />}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CREATE BOOK MODAL ─── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add New Book</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Author *</label>
                <input
                  type="text"
                  value={createForm.author}
                  onChange={(e) => setCreateForm(f => ({ ...f, author: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Illustrator</label>
                <input
                  type="text"
                  value={createForm.illustrator}
                  onChange={(e) => setCreateForm(f => ({ ...f, illustrator: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Publisher</label>
                <input
                  type="text"
                  value={createForm.publisher}
                  onChange={(e) => setCreateForm(f => ({ ...f, publisher: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">ISBN</label>
                <input
                  type="text"
                  value={createForm.isbn}
                  onChange={(e) => setCreateForm(f => ({ ...f, isbn: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Age Min</label>
                <input
                  type="number"
                  value={createForm.age_min}
                  onChange={(e) => setCreateForm(f => ({ ...f, age_min: Number(e.target.value) }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Age Max</label>
                <input
                  type="number"
                  value={createForm.age_max}
                  onChange={(e) => setCreateForm(f => ({ ...f, age_max: Number(e.target.value) }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reading Level</label>
                <select
                  value={createForm.reading_level}
                  onChange={(e) => setCreateForm(f => ({ ...f, reading_level: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none"
                >
                  <option value="">Select level</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={createForm.genres}
                  onChange={(e) => setCreateForm(f => ({ ...f, genres: e.target.value }))}
                  placeholder="Fiction, Fantasy, Indian Literature"
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Themes (comma-separated)</label>
                <input
                  type="text"
                  value={createForm.themes}
                  onChange={(e) => setCreateForm(f => ({ ...f, themes: e.target.value }))}
                  placeholder="Friendship, Nature, Growth"
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Skills Targeted</label>
                <SkillCategorySelect
                  value={createForm.skills_targeted}
                  onChange={(v) => setCreateForm(f => ({ ...f, skills_targeted: v as string[] }))}
                  multiple
                  context="admin"
                  placeholder="Select skills..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Affiliate URL</label>
                <input
                  type="text"
                  value={createForm.affiliate_url}
                  onChange={(e) => setCreateForm(f => ({ ...f, affiliate_url: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Source URL</label>
                <input
                  type="text"
                  value={createForm.source_url}
                  onChange={(e) => setCreateForm(f => ({ ...f, source_url: e.target.value }))}
                  className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Rucha&apos;s Review</label>
                <textarea
                  value={createForm.rucha_review}
                  onChange={(e) => setCreateForm(f => ({ ...f, rucha_review: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-gray-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={createForm.is_available_for_coaching}
                  onChange={(e) => setCreateForm(f => ({ ...f, is_available_for_coaching: e.target.checked }))}
                  className="rounded"
                />
                Available for Coaching
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={createForm.is_available_for_kahani_times}
                  onChange={(e) => setCreateForm(f => ({ ...f, is_available_for_kahani_times: e.target.checked }))}
                  className="rounded"
                />
                Available for Kahani Times
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 h-10 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createSaving || !createForm.title || !createForm.author}
                className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium bg-white text-[#0a0a0f] hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {createSaving && <Spinner size="sm" color="muted" />}
                Create Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
