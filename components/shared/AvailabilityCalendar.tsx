// ============================================================
// FILE: components/shared/AvailabilityCalendar.tsx
// ============================================================
// Coach Availability Manager - Enhanced with:
// - Quick templates for common schedules
// - Session type filtering
// - Mobile-responsive design
// - Copy/paste schedule
// - Batch delete
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Plus, Trash2, Loader2,
  AlertCircle, Check, X, Eye, EyeOff,
  Sparkles, Zap, Copy, ClipboardPaste,
  CheckSquare, GraduationCap, Users, Phone,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// TYPES
// ============================================================

interface ScheduleRule {
  id: string;
  coach_id: string;
  rule_type: 'available' | 'unavailable';
  scope: 'weekly' | 'date_specific';
  day_of_week?: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
  reason?: string;
  session_types?: string[];
  is_active: boolean;
}

interface PreviewSlot {
  name: string;
  displayName: string;
  emoji: string;
  totalSlots: number;
}

interface QuickTemplate {
  id: string;
  label: string;
  description: string;
  days: number[];
  startTime: string;
  endTime: string;
}

interface AvailabilityCalendarProps {
  coachId: string;
  readOnly?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
];

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '06:30', label: '6:30 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
];

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'weekday-morning',
    label: 'Weekday Mornings',
    description: 'Mon-Fri, 9 AM - 12 PM',
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '12:00',
  },
  {
    id: 'weekday-afternoon',
    label: 'Weekday Afternoons',
    description: 'Mon-Fri, 12 PM - 4 PM',
    days: [1, 2, 3, 4, 5],
    startTime: '12:00',
    endTime: '16:00',
  },
  {
    id: 'weekday-evening',
    label: 'Weekday Evenings',
    description: 'Mon-Fri, 4 PM - 8 PM',
    days: [1, 2, 3, 4, 5],
    startTime: '16:00',
    endTime: '20:00',
  },
  {
    id: 'weekday-full',
    label: 'Weekday Full',
    description: 'Mon-Fri, 9 AM - 6 PM',
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '18:00',
  },
  {
    id: 'weekend-only',
    label: 'Weekends',
    description: 'Sat-Sun, 10 AM - 6 PM',
    days: [0, 6],
    startTime: '10:00',
    endTime: '18:00',
  },
  {
    id: 'all-week',
    label: 'All Week',
    description: 'Mon-Sun, 9 AM - 8 PM',
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '20:00',
  },
];

const SESSION_TYPES = [
  { id: 'coaching', label: 'Coaching', icon: GraduationCap, color: 'text-blue-400' },
  { id: 'parent_checkin', label: 'Check-ins', icon: Users, color: 'text-green-400' },
  { id: 'skill_booster', label: 'Skill Boost', icon: Sparkles, color: 'text-purple-400' },
  { id: 'discovery', label: 'Discovery', icon: Phone, color: 'text-orange-400' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AvailabilityCalendar({ coachId, readOnly = false }: AvailabilityCalendarProps) {
  // State
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewSlot[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Selection mode for batch delete
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    selectedDays: [] as number[],
    startTime: '09:00',
    endTime: '17:00',
    sessionTypes: ['coaching', 'parent_checkin', 'skill_booster', 'discovery'] as string[],
  });

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/coach/schedule-rules?coachId=${coachId}`);
      const data = await res.json();

      if (data.success) {
        setRules(data.rules || []);
      } else {
        setError(data.error || 'Failed to load schedule');
      }
    } catch (err) {
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const fetchPreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      const res = await fetch(`/api/scheduling/slots?coachId=${coachId}&days=7&sessionType=discovery`);
      const data = await res.json();

      if (data.success) {
        setPreviewData(data.slotsByBucket || []);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const handleAddRule = async () => {
    if (formData.selectedDays.length === 0) {
      setError('Please select at least one day');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setError('End time must be after start time');
      return;
    }

    if (formData.sessionTypes.length === 0) {
      setError('Please select at least one session type');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/schedule-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          ruleType: 'available',
          scope: 'weekly',
          daysOfWeek: formData.selectedDays,
          startTime: formData.startTime,
          endTime: formData.endTime,
          sessionTypes: formData.sessionTypes,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Added availability for ${formData.selectedDays.length} day(s)`);
        setShowAddForm(false);
        setFormData({ selectedDays: [], startTime: '09:00', endTime: '17:00', sessionTypes: ['coaching', 'parent_checkin', 'skill_booster', 'discovery'] });
        fetchRules();
        if (showPreview) fetchPreview();
      } else {
        setError(data.error || 'Failed to add');
      }
    } catch (err) {
      setError('Failed to add availability');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/coach/schedule-rules?id=${ruleId}&coachId=${coachId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Removed availability');
        fetchRules();
        if (showPreview) fetchPreview();
      } else {
        setError(data.error || 'Failed to remove');
      }
    } catch (err) {
      setError('Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRules.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedRules.length} schedule rule${selectedRules.length > 1 ? 's' : ''}?`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/coach/schedule-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, ids: selectedRules }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Deleted ${data.deleted} rule(s)`);
        setSelectedRules([]);
        setSelectionMode(false);
        fetchRules();
        if (showPreview) fetchPreview();
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Failed to delete rules');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // TEMPLATE OPERATIONS
  // ============================================================

  const applyTemplate = async (template: QuickTemplate) => {
    if (rules.length > 0) {
      const confirmed = window.confirm(
        `This will replace your current schedule with "${template.label}". Continue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      // Delete all existing rules
      await fetch('/api/coach/schedule-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, deleteAll: true }),
      });

      // Create new rules from template
      const res = await fetch('/api/coach/schedule-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          ruleType: 'available',
          scope: 'weekly',
          daysOfWeek: template.days,
          startTime: template.startTime,
          endTime: template.endTime,
          sessionTypes: ['coaching', 'parent_checkin', 'skill_booster', 'discovery'],
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Applied "${template.label}" template`);
        setShowTemplates(false);
        fetchRules();
        if (showPreview) fetchPreview();
      } else {
        setError(data.error || 'Failed to apply template');
      }
    } catch (err) {
      setError('Failed to apply template');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // COPY/PASTE OPERATIONS
  // ============================================================

  const copySchedule = () => {
    const currentRules = rules.map(r => ({
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      session_types: r.session_types,
    }));

    localStorage.setItem('copied_schedule', JSON.stringify(currentRules));
    setSuccess('Schedule copied! You can paste it later.');
  };

  const pasteSchedule = async () => {
    const copied = localStorage.getItem('copied_schedule');
    if (!copied) {
      setError('No schedule copied. Copy a schedule first.');
      return;
    }

    const confirmed = window.confirm('This will replace your current schedule. Continue?');
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const copiedRules = JSON.parse(copied);

      // Delete all existing rules
      await fetch('/api/coach/schedule-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, deleteAll: true }),
      });

      // Create rules from copied data
      for (const rule of copiedRules) {
        await fetch('/api/coach/schedule-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId,
            ruleType: 'available',
            scope: 'weekly',
            daysOfWeek: [rule.day_of_week],
            startTime: rule.start_time,
            endTime: rule.end_time,
            sessionTypes: rule.session_types || ['coaching', 'parent_checkin', 'skill_booster', 'discovery'],
          }),
        });
      }

      setSuccess('Schedule pasted!');
      fetchRules();
      if (showPreview) fetchPreview();
    } catch (err) {
      setError('Failed to paste schedule');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getRulesForDay = (dayOfWeek: number): ScheduleRule[] => {
    return rules.filter(r =>
      r.scope === 'weekly' &&
      r.day_of_week === dayOfWeek &&
      r.rule_type === 'available' &&
      r.is_active
    ).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day],
    }));
  };

  const toggleSessionType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.includes(type)
        ? prev.sessionTypes.filter(t => t !== type)
        : [...prev.sessionTypes, type],
    }));
  };

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRules(prev =>
      prev.includes(ruleId)
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const selectAllRules = () => {
    setSelectedRules(rules.map(r => r.id));
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const hasCopiedSchedule = typeof window !== 'undefined' && localStorage.getItem('copied_schedule');

  // ============================================================
  // RENDER - LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }

  // ============================================================
  // RENDER - MAIN
  // ============================================================

  return (
    <div className="bg-[#1a1a24]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FF0099]" />
              Weekly Schedule
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Set when you&apos;re available for sessions
            </p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowPreview(!showPreview);
                  if (!showPreview) fetchPreview();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showPreview ? 'Hide' : 'Preview'}</span>
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); clearMessages(); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF0099] hover:bg-[#e6008a] text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Hours
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions Bar */}
        {!readOnly && !showAddForm && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Templates Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-2 px-3 h-10 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
              >
                <Zap className="w-4 h-4 text-yellow-400" />
                Templates
                <ChevronDown className={cn('w-4 h-4 transition-transform', showTemplates && 'rotate-180')} />
              </button>

              {showTemplates && (
                <div className="absolute top-12 left-0 z-10 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-2">
                  {QUICK_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      disabled={saving}
                      className="w-full text-left p-3 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-white text-sm">{template.label}</div>
                      <div className="text-xs text-gray-400">{template.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Copy/Paste */}
            <button
              onClick={copySchedule}
              disabled={rules.length === 0}
              className="flex items-center gap-2 px-3 h-10 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copy</span>
            </button>
            <button
              onClick={pasteSchedule}
              disabled={!hasCopiedSchedule}
              className="flex items-center gap-2 px-3 h-10 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span className="hidden sm:inline">Paste</span>
            </button>

            {/* Selection Mode */}
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedRules([]);
              }}
              className={cn(
                'flex items-center gap-2 px-3 h-10 rounded-xl text-sm transition-colors',
                selectionMode
                  ? 'bg-[#FF0099]/20 text-[#FF0099] border border-[#FF0099]'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">{selectionMode ? 'Selecting' : 'Select'}</span>
            </button>
          </div>
        )}

        {/* Selection Mode Actions */}
        {selectionMode && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
            <span className="text-sm text-gray-300">
              {selectedRules.length} selected
            </span>
            <button
              onClick={selectAllRules}
              className="text-sm text-[#FF0099] font-medium"
            >
              Select All
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedRules.length === 0 || saving}
              className="flex items-center gap-1 px-3 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedRules([]);
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/30 border border-red-800 rounded-xl flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-900/30 border border-green-800 rounded-xl flex items-center gap-2 text-green-400 text-sm">
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <div className="mx-4 mt-4 p-4 bg-gray-900 rounded-xl border border-gray-800">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00ABFF]" />
            How Parents See Your Availability (Next 7 Days)
          </h4>
          {previewLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF0099]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {previewData.map(bucket => (
                <div
                  key={bucket.name}
                  className={cn(
                    'p-3 rounded-lg text-center',
                    bucket.totalSlots > 0
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-gray-800 border border-gray-700'
                  )}
                >
                  <span className="text-lg">{bucket.emoji}</span>
                  <div className={cn('text-xl font-bold', bucket.totalSlots > 0 ? 'text-emerald-400' : 'text-gray-500')}>
                    {bucket.totalSlots}
                  </div>
                  <div className="text-xs text-gray-400">{bucket.displayName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && !readOnly && (
        <div className="mx-4 mt-4 p-4 bg-gray-900 rounded-xl border border-[#FF0099]/30">
          <h4 className="text-sm font-medium text-white mb-4">Add Available Hours</h4>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">Select Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium transition-colors min-w-[48px]',
                    formData.selectedDays.includes(day.value)
                      ? 'bg-[#FF0099] text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Time</label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:border-[#FF0099] focus:outline-none"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Time</label>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:border-[#FF0099] focus:outline-none"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Session Types */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">Session Types</label>
            <p className="text-xs text-gray-500 mb-2">Select which sessions you&apos;re available for during these hours</p>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => toggleSessionType(id)}
                  className={cn(
                    'flex items-center gap-2 px-3 h-10 rounded-xl text-sm font-medium transition-colors',
                    formData.sessionTypes.includes(id)
                      ? 'bg-[#FF0099] text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  )}
                >
                  <Icon className={cn('w-4 h-4', formData.sessionTypes.includes(id) ? 'text-white' : color)} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddRule}
              disabled={saving || formData.selectedDays.length === 0}
              className="flex-1 px-4 py-2.5 bg-[#FF0099] hover:bg-[#e6008a] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* MOBILE VIEW - Stacked Cards */}
      <div className="sm:hidden p-4 space-y-3">
        {rules.filter(r => r.scope === 'weekly' && r.rule_type === 'available').length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No availability set</p>
            {!readOnly && (
              <p className="text-sm text-gray-500">
                Click &quot;Add Hours&quot; or use a template
              </p>
            )}
          </div>
        ) : (
          DAYS.map(day => {
            const dayRules = getRulesForDay(day.value);
            if (dayRules.length === 0) return null;

            return (
              <div key={day.value} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white">{day.full}</span>
                  {!readOnly && (
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, selectedDays: [day.value] }));
                        setShowAddForm(true);
                      }}
                      className="text-[#FF0099] text-sm font-medium"
                    >
                      + Add
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {dayRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-3 py-2',
                        selectionMode && selectedRules.includes(rule.id)
                          ? 'bg-[#FF0099]/20 border border-[#FF0099]'
                          : 'bg-emerald-500/10'
                      )}
                      onClick={() => selectionMode && toggleRuleSelection(rule.id)}
                    >
                      <div className="flex items-center gap-3">
                        {selectionMode && (
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center',
                            selectedRules.includes(rule.id)
                              ? 'border-[#FF0099] bg-[#FF0099]'
                              : 'border-gray-500'
                          )}>
                            {selectedRules.includes(rule.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                        <span className="text-sm font-medium text-emerald-400">
                          {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Session type indicators */}
                        <div className="flex gap-1">
                          {(rule.session_types || []).slice(0, 3).map((type) => {
                            const sessionType = SESSION_TYPES.find(s => s.id === type);
                            if (!sessionType) return null;
                            const Icon = sessionType.icon;
                            return (
                              <span key={type} title={sessionType.label}>
                                <Icon className={cn('w-3.5 h-3.5', sessionType.color)} />
                              </span>
                            );
                          })}
                          {(rule.session_types?.length || 0) > 3 && (
                            <span className="text-xs text-gray-500">+{(rule.session_types?.length || 0) - 3}</span>
                          )}
                        </div>
                        {!readOnly && !selectionMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                            className="text-gray-500 hover:text-red-400 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW - Weekly Grid */}
      <div className="hidden sm:block p-4">
        {rules.filter(r => r.scope === 'weekly' && r.rule_type === 'available').length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No availability set</p>
            {!readOnly && (
              <p className="text-sm text-gray-500">
                Click &quot;Add Hours&quot; or use a template to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map(day => {
              const dayRules = getRulesForDay(day.value);
              const isOff = dayRules.length === 0;

              return (
                <div key={day.value} className="min-h-[120px]">
                  {/* Day Header */}
                  <div className={cn(
                    'text-center py-2 rounded-t-lg text-sm font-medium',
                    isOff ? 'bg-gray-800 text-gray-500' : 'bg-gray-800 text-white'
                  )}>
                    {day.label}
                  </div>

                  {/* Day Content */}
                  <div className={cn(
                    'p-2 rounded-b-lg min-h-[80px]',
                    isOff ? 'bg-gray-900/50' : 'bg-gray-900'
                  )}>
                    {isOff ? (
                      <div className="text-center py-4">
                        <span className="text-xs text-gray-600">OFF</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dayRules.map(rule => (
                          <div
                            key={rule.id}
                            onClick={() => selectionMode && toggleRuleSelection(rule.id)}
                            className={cn(
                              'group relative p-2 border rounded text-xs cursor-pointer',
                              selectionMode && selectedRules.includes(rule.id)
                                ? 'bg-[#FF0099]/20 border-[#FF0099]'
                                : 'bg-emerald-500/10 border-emerald-500/30'
                            )}
                          >
                            {selectionMode && (
                              <div className={cn(
                                'absolute top-1 left-1 w-4 h-4 rounded border flex items-center justify-center',
                                selectedRules.includes(rule.id)
                                  ? 'border-[#FF0099] bg-[#FF0099]'
                                  : 'border-gray-500'
                              )}>
                                {selectedRules.includes(rule.id) && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            )}
                            <div className="text-emerald-400 font-medium">
                              {formatTime(rule.start_time)}
                            </div>
                            <div className="text-emerald-400/70">
                              {formatTime(rule.end_time)}
                            </div>
                            {/* Session type dots */}
                            <div className="flex gap-0.5 mt-1">
                              {(rule.session_types || []).map((type) => {
                                const sessionType = SESSION_TYPES.find(s => s.id === type);
                                return (
                                  <div
                                    key={type}
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full',
                                      type === 'coaching' && 'bg-blue-400',
                                      type === 'parent_checkin' && 'bg-green-400',
                                      type === 'skill_booster' && 'bg-purple-400',
                                      type === 'discovery' && 'bg-orange-400'
                                    )}
                                    title={sessionType?.label}
                                  />
                                );
                              })}
                            </div>
                            {!readOnly && !selectionMode && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 text-center">
          Parents can book sessions during your available hours. Use &quot;Time Off&quot; below for specific dates.
        </p>
      </div>
    </div>
  );
}
