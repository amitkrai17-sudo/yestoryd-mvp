'use client';

// ============================================================================
// COACH AVAILABILITY MANAGER
// components/coach/CoachAvailabilityManager.tsx
// ============================================================================
// 
// Features:
// - View weekly schedule in visual grid
// - Add/edit/remove availability slots
// - Mark specific dates as time off
// - Preview how parents see availability
//
// Works with: coach_schedule_rules table
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  Loader2,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Coffee,
  AlertCircle,
  Eye
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ScheduleRule {
  id: string;
  coach_id: string;
  rule_type: 'available' | 'unavailable';
  scope: 'weekly' | 'date_specific';
  day_of_week?: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
  priority: number;
  applies_to: string;
  reason?: string;
  is_active: boolean;
}

interface TimeBucket {
  name: string;
  displayName: string;
  emoji: string;
  startHour: number;
  endHour: number;
}

interface CoachAvailabilityManagerProps {
  coachId: string;
  coachName?: string;
  readOnly?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const TIME_SLOTS = [
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
  { value: '21:30', label: '9:30 PM' },
  { value: '22:00', label: '10:00 PM' },
];

const TIME_BUCKETS: TimeBucket[] = [
  { name: 'early_morning', displayName: 'Early Morning', emoji: '🌅', startHour: 6, endHour: 9 },
  { name: 'morning', displayName: 'Morning', emoji: '☀️', startHour: 9, endHour: 12 },
  { name: 'afternoon', displayName: 'Afternoon', emoji: '🌤️', startHour: 12, endHour: 16 },
  { name: 'evening', displayName: 'Evening', emoji: '🌆', startHour: 16, endHour: 20 },
  { name: 'night', displayName: 'Night', emoji: '🌙', startHour: 20, endHour: 22 },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CoachAvailabilityManager({ 
  coachId, 
  coachName = 'Coach',
  readOnly = false 
}: CoachAvailabilityManagerProps) {
  // State
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewSlots, setPreviewSlots] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state for new rule
  const [newRule, setNewRule] = useState({
    ruleType: 'available' as 'available' | 'unavailable',
    scope: 'weekly' as 'weekly' | 'date_specific',
    daysOfWeek: [] as number[],
    specificDate: '',
    startTime: '09:00',
    endTime: '17:00',
    reason: '',
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    fetchRules();
  }, [coachId]);

  async function fetchRules() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/coach/schedule-rules?coachId=${coachId}`);
      const data = await response.json();
      
      if (data.success) {
        setRules(data.rules || []);
      } else {
        setError(data.error || 'Failed to load schedule');
      }
    } catch (err) {
      setError('Failed to load schedule');
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPreview() {
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/scheduling/slots?coachId=${coachId}&days=7&sessionType=discovery`);
      const data = await response.json();
      
      if (data.success) {
        setPreviewSlots(data.slotsByBucket || []);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async function saveRule() {
    setSaving(true);
    setError(null);
    
    try {
      const payload = {
        coachId,
        ruleType: newRule.ruleType,
        scope: newRule.scope,
        daysOfWeek: newRule.scope === 'weekly' ? newRule.daysOfWeek : undefined,
        specificDate: newRule.scope === 'date_specific' ? newRule.specificDate : undefined,
        startTime: newRule.startTime,
        endTime: newRule.endTime,
        reason: newRule.reason || undefined,
      };

      const response = await fetch('/api/coach/schedule-rules', {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule ? { ...payload, id: editingRule.id } : payload),
      });

      const data = await response.json();

      if (data.success) {
        await fetchRules();
        resetForm();
        setShowAddModal(false);
        setShowTimeOffModal(false);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save');
      console.error('Error saving rule:', err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/schedule-rules?id=${ruleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchRules();
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Failed to delete');
      console.error('Error deleting rule:', err);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setNewRule({
      ruleType: 'available',
      scope: 'weekly',
      daysOfWeek: [],
      specificDate: '',
      startTime: '09:00',
      endTime: '17:00',
      reason: '',
    });
    setEditingRule(null);
  }

  function editRule(rule: ScheduleRule) {
    setEditingRule(rule);
    setNewRule({
      ruleType: rule.rule_type,
      scope: rule.scope,
      daysOfWeek: rule.day_of_week !== undefined ? [rule.day_of_week] : [],
      specificDate: rule.specific_date || '',
      startTime: rule.start_time.slice(0, 5),
      endTime: rule.end_time.slice(0, 5),
      reason: rule.reason || '',
    });
    setShowAddModal(true);
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  function getDayName(dayOfWeek: number): string {
    return DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || '';
  }

  function getWeeklyRulesForDay(dayOfWeek: number): ScheduleRule[] {
    return rules.filter(r => 
      r.scope === 'weekly' && 
      r.day_of_week === dayOfWeek && 
      r.is_active
    );
  }

  function getTimeOffRules(): ScheduleRule[] {
    return rules.filter(r => 
      r.scope === 'date_specific' && 
      r.is_active
    );
  }

  function getBucketIcon(bucketName: string) {
    switch (bucketName) {
      case 'early_morning': return <Sunrise className="w-4 h-4" />;
      case 'morning': return <Sun className="w-4 h-4" />;
      case 'afternoon': return <Coffee className="w-4 h-4" />;
      case 'evening': return <Sunset className="w-4 h-4" />;
      case 'night': return <Moon className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">My Availability</h2>
          <p className="text-gray-400 text-sm mt-1">
            Set when you're available for coaching sessions
          </p>
        </div>
        
        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowPreview(!showPreview);
                if (!showPreview) fetchPreview();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#00ABFF] hover:bg-[#0095e0] text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Availability
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <div className="p-4 bg-[#1a1a24] border border-gray-700 rounded-xl">
          <h3 className="font-medium text-white mb-3">How Parents See Your Availability (Next 7 Days)</h3>
          
          {previewLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#00ABFF]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {previewSlots.map((bucket: any) => (
                <div 
                  key={bucket.name}
                  className={`p-3 rounded-lg border ${
                    bucket.totalSlots > 0 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{bucket.emoji}</span>
                    <span className="text-sm font-medium text-white">{bucket.displayName}</span>
                  </div>
                  <div className={`text-2xl font-bold ${
                    bucket.totalSlots > 0 ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {bucket.totalSlots}
                  </div>
                  <div className="text-xs text-gray-400">slots available</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly Schedule Grid */}
      <div className="bg-[#1a1a24] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00ABFF]" />
            Weekly Schedule
          </h3>
        </div>
        
        <div className="grid grid-cols-7 divide-x divide-gray-700">
          {DAYS_OF_WEEK.map(day => {
            const dayRules = getWeeklyRulesForDay(day.value);
            const availableRules = dayRules.filter(r => r.rule_type === 'available');
            const unavailableRules = dayRules.filter(r => r.rule_type === 'unavailable');
            
            return (
              <div key={day.value} className="min-h-[200px]">
                {/* Day Header */}
                <div className={`p-3 text-center border-b border-gray-700 ${
                  day.value === 0 ? 'bg-gray-800' : 'bg-[#12121a]'
                }`}>
                  <div className="font-medium text-white">{day.short}</div>
                </div>
                
                {/* Day Content */}
                <div className="p-2 space-y-2">
                  {availableRules.length === 0 && unavailableRules.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-gray-500 text-xs">No availability set</div>
                      {!readOnly && (
                        <button
                          onClick={() => {
                            resetForm();
                            setNewRule(prev => ({ ...prev, daysOfWeek: [day.value] }));
                            setShowAddModal(true);
                          }}
                          className="mt-2 text-[#00ABFF] text-xs hover:underline"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Available Slots */}
                      {availableRules.map(rule => (
                        <div 
                          key={rule.id}
                          className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-emerald-400 font-medium">
                              {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                            </div>
                            {!readOnly && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => editRule(rule)}
                                  className="p-1 hover:bg-emerald-500/20 rounded"
                                >
                                  <Edit2 className="w-3 h-3 text-emerald-400" />
                                </button>
                                <button 
                                  onClick={() => deleteRule(rule.id)}
                                  className="p-1 hover:bg-red-500/20 rounded"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                            )}
                          </div>
                          {rule.reason && (
                            <div className="text-xs text-gray-400 mt-1 truncate">
                              {rule.reason}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Unavailable/Blocked Slots */}
                      {unavailableRules.map(rule => (
                        <div 
                          key={rule.id}
                          className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-red-400 font-medium">
                              {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                            </div>
                            {!readOnly && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => editRule(rule)}
                                  className="p-1 hover:bg-red-500/20 rounded"
                                >
                                  <Edit2 className="w-3 h-3 text-red-400" />
                                </button>
                                <button 
                                  onClick={() => deleteRule(rule.id)}
                                  className="p-1 hover:bg-red-500/20 rounded"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                            )}
                          </div>
                          {rule.reason && (
                            <div className="text-xs text-gray-400 mt-1 truncate">
                              {rule.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Off Section */}
      <div className="bg-[#1a1a24] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            Time Off (Specific Dates)
          </h3>
          {!readOnly && (
            <button
              onClick={() => {
                resetForm();
                setNewRule(prev => ({ 
                  ...prev, 
                  scope: 'date_specific',
                  ruleType: 'unavailable',
                  startTime: '00:00',
                  endTime: '23:59',
                }));
                setShowTimeOffModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Mark Time Off
            </button>
          )}
        </div>
        
        <div className="p-4">
          {getTimeOffRules().length === 0 ? (
            <p className="text-gray-500 text-sm">No time off scheduled</p>
          ) : (
            <div className="space-y-2">
              {getTimeOffRules().map(rule => (
                <div 
                  key={rule.id}
                  className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                >
                  <div>
                    <div className="text-white font-medium">
                      {rule.specific_date && new Date(rule.specific_date).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-orange-400">
                      {rule.start_time === '00:00' && rule.end_time === '23:59' 
                        ? 'All Day' 
                        : `${formatTime(rule.start_time)} - ${formatTime(rule.end_time)}`
                      }
                      {rule.reason && ` • ${rule.reason}`}
                    </div>
                  </div>
                  {!readOnly && (
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Availability Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a24] border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">
                {editingRule ? 'Edit Availability' : 'Add Availability'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Rule Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewRule(prev => ({ ...prev, ruleType: 'available' }))}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      newRule.ruleType === 'available'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Check className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm">Available</div>
                  </button>
                  <button
                    onClick={() => setNewRule(prev => ({ ...prev, ruleType: 'unavailable' }))}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      newRule.ruleType === 'unavailable'
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <X className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm">Blocked</div>
                  </button>
                </div>
              </div>

              {/* Days Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      onClick={() => {
                        setNewRule(prev => ({
                          ...prev,
                          daysOfWeek: prev.daysOfWeek.includes(day.value)
                            ? prev.daysOfWeek.filter(d => d !== day.value)
                            : [...prev.daysOfWeek, day.value],
                        }));
                      }}
                      className={`px-3 py-2 rounded-lg border transition-colors ${
                        newRule.daysOfWeek.includes(day.value)
                          ? 'bg-[#00ABFF]/20 border-[#00ABFF] text-[#00ABFF]'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Time
                  </label>
                  <select
                    value={newRule.startTime}
                    onChange={(e) => setNewRule(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00ABFF] focus:outline-none"
                  >
                    {TIME_SLOTS.map(slot => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Time
                  </label>
                  <select
                    value={newRule.endTime}
                    onChange={(e) => setNewRule(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00ABFF] focus:outline-none"
                  >
                    {TIME_SLOTS.map(slot => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={newRule.reason}
                  onChange={(e) => setNewRule(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Morning coaching slot"
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#00ABFF] focus:outline-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={saving || newRule.daysOfWeek.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ABFF] hover:bg-[#0095e0] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingRule ? 'Update' : 'Add'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a24] border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white">Mark Time Off</h3>
              <button 
                onClick={() => {
                  setShowTimeOffModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={newRule.specificDate}
                  onChange={(e) => setNewRule(prev => ({ ...prev, specificDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00ABFF] focus:outline-none"
                />
              </div>

              {/* All Day Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.startTime === '00:00' && newRule.endTime === '23:59'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewRule(prev => ({ ...prev, startTime: '00:00', endTime: '23:59' }));
                      } else {
                        setNewRule(prev => ({ ...prev, startTime: '09:00', endTime: '17:00' }));
                      }
                    }}
                    className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-[#00ABFF] focus:ring-[#00ABFF]"
                  />
                  <span className="text-gray-300">All Day</span>
                </label>
              </div>

              {/* Time Range (if not all day) */}
              {!(newRule.startTime === '00:00' && newRule.endTime === '23:59') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Time
                    </label>
                    <select
                      value={newRule.startTime}
                      onChange={(e) => setNewRule(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00ABFF] focus:outline-none"
                    >
                      {TIME_SLOTS.map(slot => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      End Time
                    </label>
                    <select
                      value={newRule.endTime}
                      onChange={(e) => setNewRule(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00ABFF] focus:outline-none"
                    >
                      {TIME_SLOTS.map(slot => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={newRule.reason}
                  onChange={(e) => setNewRule(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Vacation, Doctor's appointment"
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#00ABFF] focus:outline-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTimeOffModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={saving || !newRule.specificDate}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Mark Time Off
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
