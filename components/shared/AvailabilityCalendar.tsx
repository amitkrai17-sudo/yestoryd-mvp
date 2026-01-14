// ============================================================
// FILE: components/shared/AvailabilityCalendar.tsx
// ============================================================
// Coach Availability Manager - Rule-based system
// Coach defines WHEN they're available (not when blocked)
// Single source of truth: coach_schedule_rules table
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Plus, Trash2, Loader2,
  AlertCircle, Check, X, Eye, EyeOff,
  ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';

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
  is_active: boolean;
}

interface PreviewSlot {
  name: string;
  displayName: string;
  emoji: string;
  totalSlots: number;
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
  const [previewData, setPreviewData] = useState<PreviewSlot[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state - simple single slot addition
  const [formData, setFormData] = useState({
    selectedDays: [] as number[],
    startTime: '09:00',
    endTime: '17:00',
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
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Added availability for ${formData.selectedDays.length} day(s)`);
        setShowAddForm(false);
        setFormData({ selectedDays: [], startTime: '09:00', endTime: '17:00' });
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

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

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
      <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF0099]" />
            Weekly Schedule
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Set when you're available for sessions
          </p>
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowPreview(!showPreview);
                if (!showPreview) fetchPreview();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{showPreview ? 'Hide' : 'Preview'}</span>
            </button>
            <button
              onClick={() => { setShowAddForm(!showAddForm); clearMessages(); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF0099] hover:bg-[#e6008a] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Hours
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-900/30 border border-green-800 rounded-lg flex items-center gap-2 text-green-400 text-sm">
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <div className="mx-4 mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
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
                  className={`p-3 rounded-lg text-center ${
                    bucket.totalSlots > 0
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                >
                  <span className="text-lg">{bucket.emoji}</span>
                  <div className={`text-xl font-bold ${bucket.totalSlots > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
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
        <div className="mx-4 mt-4 p-4 bg-gray-900 rounded-lg border border-[#FF0099]/30">
          <h4 className="text-sm font-medium text-white mb-4">Add Available Hours</h4>

          {/* Day Selection */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">Select Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.selectedDays.includes(day.value)
                      ? 'bg-[#FF0099] text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-[#FF0099] focus:outline-none"
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-[#FF0099] focus:outline-none"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddRule}
              disabled={saving || formData.selectedDays.length === 0}
              className="flex-1 px-4 py-2 bg-[#FF0099] hover:bg-[#e6008a] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="p-4">
        {rules.filter(r => r.scope === 'weekly' && r.rule_type === 'available').length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No availability set</p>
            {!readOnly && (
              <p className="text-sm text-gray-500">
                Click "Add Hours" to set your weekly schedule
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DAYS.map(day => {
              const dayRules = getRulesForDay(day.value);
              const isOff = dayRules.length === 0;

              return (
                <div key={day.value} className="min-h-[120px]">
                  {/* Day Header */}
                  <div className={`text-center py-2 rounded-t-lg text-sm font-medium ${
                    isOff ? 'bg-gray-800 text-gray-500' : 'bg-gray-800 text-white'
                  }`}>
                    <span className="hidden sm:inline">{day.label}</span>
                    <span className="sm:hidden">{day.label.charAt(0)}</span>
                  </div>

                  {/* Day Content */}
                  <div className={`p-1 sm:p-2 rounded-b-lg min-h-[80px] ${
                    isOff ? 'bg-gray-900/50' : 'bg-gray-900'
                  }`}>
                    {isOff ? (
                      <div className="text-center py-4">
                        <span className="text-xs text-gray-600">OFF</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dayRules.map(rule => (
                          <div
                            key={rule.id}
                            className="group relative p-1.5 sm:p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs"
                          >
                            <div className="text-emerald-400 font-medium text-[10px] sm:text-xs">
                              {formatTime(rule.start_time)}
                            </div>
                            <div className="text-emerald-400/70 text-[10px] sm:text-xs">
                              {formatTime(rule.end_time)}
                            </div>
                            {!readOnly && (
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
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
          Parents can book sessions during your available hours. Use "Time Off" below for specific dates.
        </p>
      </div>
    </div>
  );
}
