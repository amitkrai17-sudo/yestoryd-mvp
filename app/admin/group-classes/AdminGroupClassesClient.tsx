// =============================================================================
// FILE: app/admin/group-classes/AdminGroupClassesClient.tsx
// PURPOSE: Admin UI for managing group class sessions
// RESTRUCTURED: Card layout with proper action menu
// =============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Calendar, Clock, Users, Search, MoreVertical,
  Edit, CheckCircle, XCircle, Copy, ExternalLink,
  BookOpen, User, Loader2, AlertCircle, X, Video,
  UserPlus, Mail, Phone, Mic
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================
interface ClassType {
  id: string;
  slug: string;
  name: string;
  icon_emoji: string;
  color_hex: string;
  price_inr: number;
  duration_minutes: number;
  age_min: number;
  age_max: number;
  max_participants: number;
  requires_book: boolean;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
}

interface Book {
  id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
}

interface BlueprintOption {
  id: string;
  name: string;
  age_band: string;
  class_type_id: string;
  total_duration_minutes: number | null;
  status: string;
}

interface Session {
  id: string;
  title: string;
  description: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  max_participants: number;
  current_participants: number;
  price_inr: number;
  age_min: number;
  age_max: number;
  status: string;
  google_meet_link: string | null;
  google_event_id: string | null;
  recall_bot_id: string | null;
  class_type: ClassType | null;
  instructor: Coach | null;
  book: Book | null;
  participants: any[];
}

interface FormData {
  classTypeId: string;
  blueprintId: string;
  title: string;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  maxParticipants: number;
  priceInr: number;
  ageMin: number;
  ageMax: number;
  instructorId: string;
  bookId: string;
  notes: string;
}

// =============================================================================
// HELPERS
// =============================================================================
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'live': return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'completed': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    case 'cancelled': return 'bg-red-500/20 text-red-400 border border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
}

// =============================================================================
// ACTION MENU COMPONENT (Fixed position overlay)
// =============================================================================
function ActionMenu({ 
  session, 
  isOpen, 
  onClose, 
  onEdit, 
  onStatusChange,
  buttonRef 
}: {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 220, // Menu width ~220px
      });
    }
  }, [isOpen, buttonRef]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  const copyMeetLink = () => {
    if (session.google_meet_link) {
      navigator.clipboard.writeText(session.google_meet_link);
      alert('Meet link copied!');
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-surface-1 rounded-xl shadow-2xl border border-border py-2 z-[100] min-w-[220px]"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={() => { onEdit(); onClose(); }}
        className="w-full px-4 py-3 text-left hover:bg-surface-2 flex items-center gap-3 text-text-secondary"
      >
        <Edit className="w-4 h-4" />
        Edit Session
      </button>

      {session.google_meet_link && (
        <>
          <button
            onClick={copyMeetLink}
            className="w-full px-4 py-3 text-left hover:bg-surface-2 flex items-center gap-3 text-text-secondary"
          >
            <Copy className="w-4 h-4" />
            Copy Meet Link
          </button>
          <a
            href={session.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full px-4 py-3 text-left hover:bg-surface-2 flex items-center gap-3 text-text-secondary"
          >
            <ExternalLink className="w-4 h-4" />
            Open Meet
          </a>
        </>
      )}

      <hr className="my-2 border-border" />

      {session.status !== 'cancelled' && (
        <>
          {session.status === 'scheduled' && (
            <button
              onClick={() => { onStatusChange('completed'); onClose(); }}
              className="w-full px-4 py-3 text-left hover:bg-green-500/10 flex items-center gap-3 text-green-400"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
          )}
          <button
            onClick={() => { onStatusChange('cancelled'); onClose(); }}
            className="w-full px-4 py-3 text-left hover:bg-red-500/10 flex items-center gap-3 text-red-400 font-medium"
          >
            <XCircle className="w-4 h-4" />
            Cancel Session
          </button>
        </>
      )}

      {session.status === 'cancelled' && (
        <div className="px-4 py-3 text-text-tertiary text-sm italic">
          Session already cancelled
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SESSION CARD COMPONENT
// =============================================================================
function SessionCard({
  session,
  onEdit,
  onStatusChange,
}: {
  session: Session;
  onEdit: (session: Session) => void;
  onStatusChange: (sessionId: string, status: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="bg-surface-1 rounded-xl border border-border p-5 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/[0.08] rounded-xl flex items-center justify-center text-2xl">
            {session.class_type?.icon_emoji || '📚'}
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">{session.title}</h3>
            <p className="text-sm text-text-tertiary">
              {session.class_type?.name || 'Group Class'}
              {session.instructor && ` • ${session.instructor.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(session.status)}`}>
            {session.status}
          </span>
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-surface-3 rounded-xl"
          >
            <MoreVertical className="w-5 h-5 text-text-tertiary" />
          </button>
          
          <ActionMenu
            session={session}
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onEdit={() => onEdit(session)}
            onStatusChange={(status) => onStatusChange(session.id, status)}
            buttonRef={buttonRef}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Calendar className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm">{formatDate(session.scheduled_date)}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm">{formatTime(session.scheduled_time)}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Users className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm">{session.current_participants}/{session.max_participants} kids</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="text-sm font-semibold text-gray-300">₹{session.price_inr}</span>
        </div>
      </div>

      {/* Integration Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {session.google_meet_link ? (
          <a
            href={session.google_meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium hover:bg-green-500/30 transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
            Join Meet
          </a>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-full text-xs font-medium">
            <Video className="w-3.5 h-3.5" />
            No Meet
          </span>
        )}

        {session.recall_bot_id && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] text-gray-400 border border-white/[0.08] rounded-full text-xs font-medium">
            <Mic className="w-3.5 h-3.5" />
            Recording
          </span>
        )}

        {session.book && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] text-gray-400 border border-white/[0.08] rounded-full text-xs font-medium">
            <BookOpen className="w-3.5 h-3.5" />
            {session.book.title}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SESSION MODAL
// =============================================================================
function SessionModal({
  isOpen,
  onClose,
  session,
  options,
  onSave,
  onAddInstructor,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  options: { classTypes: ClassType[]; coaches: Coach[]; books: Book[]; blueprints: BlueprintOption[] };
  onSave: () => void;
  onAddInstructor: () => void;
}) {
  const [formData, setFormData] = useState<FormData>({
    classTypeId: '',
    blueprintId: '',
    title: '',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '10:00',
    durationMinutes: 45,
    maxParticipants: 10,
    priceInr: 199,
    ageMin: 4,
    ageMax: 12,
    instructorId: '',
    bookId: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = session?.id;

  useEffect(() => {
    if (session) {
      setFormData({
        classTypeId: session.class_type?.id || '',
        blueprintId: '',
        title: session.title,
        description: session.description || '',
        scheduledDate: session.scheduled_date,
        scheduledTime: session.scheduled_time,
        durationMinutes: session.duration_minutes,
        maxParticipants: session.max_participants,
        priceInr: session.price_inr,
        ageMin: session.age_min,
        ageMax: session.age_max,
        instructorId: session.instructor?.id || '',
        bookId: session.book?.id || '',
        notes: '',
      });
    } else {
      setFormData({
        classTypeId: options.classTypes[0]?.id || '',
        blueprintId: '',
        title: '',
        description: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '10:00',
        durationMinutes: 45,
        maxParticipants: 10,
        priceInr: 199,
        ageMin: 4,
        ageMax: 12,
        instructorId: '',
        bookId: '',
        notes: '',
      });
    }
  }, [session, options.classTypes]);

  const handleClassTypeChange = (classTypeId: string) => {
    const ct = options.classTypes.find(c => c.id === classTypeId);
    if (ct) {
      setFormData(prev => ({
        ...prev,
        classTypeId,
        blueprintId: '',
        durationMinutes: ct.duration_minutes,
        maxParticipants: ct.max_participants,
        priceInr: ct.price_inr,
        ageMin: ct.age_min,
        ageMax: ct.age_max,
        title: prev.title || `${ct.name} Session`,
      }));
    }
  };

  const handleBlueprintChange = (blueprintId: string) => {
    const bp = options.blueprints.find(b => b.id === blueprintId);
    if (bp) {
      const ageMap: Record<string, { min: number; max: number }> = {
        '4-6': { min: 4, max: 6 },
        '7-9': { min: 7, max: 9 },
        '10-12': { min: 10, max: 12 },
      };
      const ages = ageMap[bp.age_band] || { min: 4, max: 12 };
      setFormData(prev => ({
        ...prev,
        blueprintId,
        title: prev.title || bp.name,
        durationMinutes: bp.total_duration_minutes || prev.durationMinutes,
        ageMin: ages.min,
        ageMax: ages.max,
      }));
    } else {
      setFormData(prev => ({ ...prev, blueprintId: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isEditMode = !!sessionId;
      
      const url = isEditMode
        ? `/api/admin/group-classes/${sessionId}`
        : '/api/admin/group-classes';

      const payload: Record<string, any> = {
        title: formData.title,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        durationMinutes: formData.durationMinutes,
        maxParticipants: formData.maxParticipants,
        priceInr: formData.priceInr,
        ageMin: formData.ageMin,
        ageMax: formData.ageMax,
      };

      if (formData.classTypeId && formData.classTypeId.trim() !== '') {
        payload.classTypeId = formData.classTypeId;
      }
      if (formData.description && formData.description.trim() !== '') {
        payload.description = formData.description;
      }
      if (formData.instructorId && formData.instructorId.trim() !== '') {
        payload.instructorId = formData.instructorId;
      }
      if (formData.bookId && formData.bookId.trim() !== '') {
        payload.bookId = formData.bookId;
      }
      if (formData.blueprintId && formData.blueprintId.trim() !== '') {
        payload.blueprintId = formData.blueprintId;
      }
      if (formData.notes && formData.notes.trim() !== '') {
        payload.notes = formData.notes;
      }

      const res = await fetch(url, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save session');
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedClassType = options.classTypes.find(c => c.id === formData.classTypeId);
  const isEditMode = !!sessionId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-surface-1 z-10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEditMode ? 'Edit Session' : 'Create New Session'}
            </h2>
            <p className="text-sm text-text-tertiary mt-1">
              {isEditMode ? 'Update session details' : 'Fill in the details for the new group class'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-xl">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Class Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-3">Class Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {options.classTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => handleClassTypeChange(ct.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.classTypeId === ct.id
                      ? 'border-white/[0.16] bg-white/[0.08]'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ct.icon_emoji}</span>
                    <div>
                      <p className="font-semibold text-white">{ct.name}</p>
                      <p className="text-xs text-text-tertiary">₹{ct.price_inr} • {ct.duration_minutes}min</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint */}
          {options.blueprints.filter(b => !formData.classTypeId || b.class_type_id === formData.classTypeId).length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Blueprint (optional)</label>
              <select
                value={formData.blueprintId}
                onChange={(e) => handleBlueprintChange(e.target.value)}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white"
              >
                <option value="">No blueprint</option>
                {options.blueprints
                  .filter(b => !formData.classTypeId || b.class_type_id === formData.classTypeId)
                  .map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name} ({bp.age_band} yrs{bp.total_duration_minutes ? ` • ${bp.total_duration_minutes}min` : ''})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-text-tertiary mt-1">Auto-fills duration and age range from the blueprint</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Session Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              placeholder="e.g., Dinosaur Discovery Reading"
              required
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Date *</label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Time *</label>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
                required
              />
            </div>
          </div>

          {/* Duration, Max Kids, Price */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Duration (min)</label>
              <input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 45 })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Max Kids</label>
              <input
                type="number"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Price (₹)</label>
              <input
                type="number"
                value={formData.priceInr}
                onChange={(e) => setFormData({ ...formData, priceInr: parseInt(e.target.value) || 199 })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              />
            </div>
          </div>

          {/* Instructor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-text-secondary">Instructor</label>
              <button
                type="button"
                onClick={onAddInstructor}
                className="text-sm text-gray-300 hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Add New
              </button>
            </div>
            <select
              value={formData.instructorId}
              onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white"
            >
              <option value="">Select instructor...</option>
              {options.coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name} ({coach.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">Calendar invite & Meet link will be sent to this instructor</p>
          </div>

          {/* Book */}
          {selectedClassType?.requires_book !== false && (
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2">Featured Book</label>
              <select
                value={formData.bookId}
                onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white"
              >
                <option value="">Select book (optional)...</option>
                {options.books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} by {book.author}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-surface-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border text-text-secondary rounded-xl font-semibold hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditMode ? (
                'Update Session'
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// ADD INSTRUCTOR MODAL
// =============================================================================
function AddInstructorModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (coach: Coach) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/group-classes/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add instructor');
      }

      onAdd(data.coach);
      setName('');
      setEmail('');
      setPhone('');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-surface-1 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Add New Instructor</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-xl">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted"
                placeholder="Instructor name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted"
                placeholder="instructor@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border text-text-secondary rounded-xl font-semibold hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold disabled:opacity-50 hover:bg-gray-200"
            >
              {loading ? 'Adding...' : 'Add Instructor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function AdminGroupClassesClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{ classTypes: ClassType[]; coaches: Coach[]; books: Book[]; blueprints: BlueprintOption[] }>({
    classTypes: [],
    coaches: [],
    books: [],
    blueprints: [],
  });
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [addInstructorOpen, setAddInstructorOpen] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchOptions();
  }, [filter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/group-classes';
      if (filter === 'cancelled') {
        url += '?status=cancelled';
      } else if (filter === 'past') {
        url += '?status=completed';
      } else {
        url += '?status=scheduled';
      }
      const res = await fetch(url);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/admin/group-classes/options');
      const data = await res.json();
      setOptions({
        classTypes: data.classTypes || [],
        coaches: data.coaches || [],
        books: data.books || [],
        blueprints: data.blueprints || [],
      });
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  };

  const handleStatusChange = async (sessionId: string, newStatus: string) => {
    if (newStatus === 'cancelled') {
      const confirmed = window.confirm(
        'Are you sure you want to cancel this session?\n\n' +
        '• Google Calendar event will be deleted\n' +
        '• Attendees will be notified\n' +
        '• Recall.ai recording will be cancelled'
      );
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/admin/group-classes/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        alert(newStatus === 'cancelled' ? 'Session cancelled successfully!' : 'Status updated!');
      }
      fetchSessions();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleAddInstructor = (coach: Coach) => {
    setOptions(prev => ({
      ...prev,
      coaches: [...prev.coaches, coach].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.instructor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.class_type?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Group Classes</h1>
              <p className="text-text-tertiary mt-1">Create sessions with auto Meet links & recording</p>
            </div>
            <button
              onClick={() => {
                setEditingSession(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Session
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Tab filters */}
          <div className="flex bg-surface-2 rounded-xl p-1">
            {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === tab
                    ? 'bg-surface-1 text-white shadow-sm'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-border rounded-xl focus:ring-2 focus:ring-white/[0.10] focus:border-transparent text-white placeholder:text-text-muted"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No sessions found</h3>
            <p className="text-text-tertiary mb-4">
              {filter === 'upcoming' ? 'Create your first group class session!' : `No ${filter} sessions.`}
            </p>
            {filter === 'upcoming' && (
              <button
                onClick={() => {
                  setEditingSession(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a0f] rounded-xl font-semibold hover:bg-gray-200"
              >
                <Plus className="w-5 h-5" />
                Create Session
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onEdit={(s) => {
                  setEditingSession(s);
                  setModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SessionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSession(null);
        }}
        session={editingSession}
        options={options}
        onSave={fetchSessions}
        onAddInstructor={() => setAddInstructorOpen(true)}
      />

      <AddInstructorModal
        isOpen={addInstructorOpen}
        onClose={() => setAddInstructorOpen(false)}
        onAdd={handleAddInstructor}
      />
    </div>
  );
}
