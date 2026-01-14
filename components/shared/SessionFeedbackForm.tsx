// ============================================================
// SESSION FEEDBACK FORM COMPONENT
// File: components/shared/SessionFeedbackForm.tsx
// Structured feedback form for coaches after sessions
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, AlertTriangle, Sparkles, MessageSquare, 
  Loader2, Check, BookOpen, Flag, Send
} from 'lucide-react';
import SkillTagSelector from './SkillTagSelector';

interface SessionFeedbackFormProps {
  sessionId: string;
  childName: string;
  sessionNumber?: number;
  existingFeedback?: any;
  onSubmit: (feedback: any) => Promise<void>;
  onCancel?: () => void;
}

interface FeedbackData {
  focus_area: string;
  progress_rating: 'improved' | 'same' | 'struggled' | '';
  engagement_level: 'high' | 'medium' | 'low' | '';
  confidence_level: number;
  skills_worked_on: string[];
  skills_improved: string[];
  skills_need_work: string[];
  next_session_focus: string[];
  breakthrough_moment: string;
  concerns_noted: string;
  coach_notes: string;
  homework_assigned: boolean;
  homework_topic: string;
  homework_description: string;
  flagged_for_attention: boolean;
  flag_reason: string;
  parent_communication_needed: boolean;
  rating_overall: number;
}

const initialFeedback: FeedbackData = {
  focus_area: '',
  progress_rating: '',
  engagement_level: '',
  confidence_level: 3,
  skills_worked_on: [],
  skills_improved: [],
  skills_need_work: [],
  next_session_focus: [],
  breakthrough_moment: '',
  concerns_noted: '',
  coach_notes: '',
  homework_assigned: false,
  homework_topic: '',
  homework_description: '',
  flagged_for_attention: false,
  flag_reason: '',
  parent_communication_needed: false,
  rating_overall: 3,
};

export default function SessionFeedbackForm({
  sessionId,
  childName,
  sessionNumber,
  existingFeedback,
  onSubmit,
  onCancel,
}: SessionFeedbackFormProps) {
  const [feedback, setFeedback] = useState<FeedbackData>(() => ({
    ...initialFeedback,
    ...existingFeedback,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'progress' | 'skills' | 'homework' | 'notes'>('progress');

  // Update handler
  const updateField = <K extends keyof FeedbackData>(
    field: K,
    value: FeedbackData[K]
  ) => {
    setFeedback(prev => ({ ...prev, [field]: value }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(feedback);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rating component
  const RatingStars = ({
    value,
    onChange,
    label,
    max = 5,
  }: {
    value: number;
    onChange: (val: number) => void;
    label: string;
    max?: number;
  }) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`p-1 rounded transition-colors ${
              i < value 
                ? 'text-yellow-400 hover:text-yellow-500' 
                : 'text-gray-300 hover:text-gray-400'
            }`}
          >
            <Star className={`w-6 h-6 ${i < value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  // Section navigation tabs
  const sections = [
    { id: 'progress', label: 'Progress', icon: Sparkles },
    { id: 'skills', label: 'Skills', icon: BookOpen },
    { id: 'homework', label: 'Homework', icon: MessageSquare },
    { id: 'notes', label: 'Notes & Flags', icon: Flag },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-blue-50 rounded-t-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Session Feedback: {childName}
        </h3>
        {sessionNumber && (
          <p className="text-sm text-gray-600">Session #{sessionNumber}</p>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors border-b-2 -mb-px
              ${activeSection === id
                ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Form content */}
      <div className="p-6 space-y-6">
        {/* PROGRESS SECTION */}
        {activeSection === 'progress' && (
          <div className="space-y-6">
            {/* Focus Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Focus Area
              </label>
              <input
                type="text"
                value={feedback.focus_area}
                onChange={(e) => updateField('focus_area', e.target.value)}
                placeholder="e.g., Digraphs, Reading fluency, Comprehension"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            {/* Progress Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How did {childName} progress today?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'improved', label: '📈 Improved', color: 'green' },
                  { value: 'same', label: '➡️ Same', color: 'yellow' },
                  { value: 'struggled', label: '📉 Struggled', color: 'red' },
                ].map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField('progress_rating', value as any)}
                    className={`
                      p-3 rounded-lg border-2 text-center transition-all
                      ${feedback.progress_rating === value
                        ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Engagement Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Engagement Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'high', label: '🔥 High', emoji: '🔥' },
                  { value: 'medium', label: '😊 Medium', emoji: '😊' },
                  { value: 'low', label: '😴 Low', emoji: '😴' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField('engagement_level', value as any)}
                    className={`
                      p-3 rounded-lg border-2 text-center transition-all
                      ${feedback.engagement_level === value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ratings */}
            <div className="grid grid-cols-2 gap-6">
              <RatingStars
                value={feedback.confidence_level}
                onChange={(val) => updateField('confidence_level', val)}
                label="Confidence Level"
              />
              <RatingStars
                value={feedback.rating_overall}
                onChange={(val) => updateField('rating_overall', val)}
                label="Overall Session Rating"
              />
            </div>

            {/* Breakthrough Moment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Sparkles className="w-4 h-4 inline mr-1 text-yellow-500" />
                Breakthrough Moment (if any)
              </label>
              <textarea
                value={feedback.breakthrough_moment}
                onChange={(e) => updateField('breakthrough_moment', e.target.value)}
                placeholder="Did anything click for the child today?"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>
        )}

        {/* SKILLS SECTION */}
        {activeSection === 'skills' && (
          <div className="space-y-6">
            {/* Skills Worked On */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills Worked On
              </label>
              <SkillTagSelector
                selectedTags={feedback.skills_worked_on}
                onChange={(tags) => updateField('skills_worked_on', tags)}
                maxTags={10}
                placeholder="Select skills covered in this session..."
              />
            </div>

            {/* Skills Improved */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-green-600">✓</span> Skills That Improved
              </label>
              <SkillTagSelector
                selectedTags={feedback.skills_improved}
                onChange={(tags) => updateField('skills_improved', tags)}
                maxTags={10}
                placeholder="Select skills that showed improvement..."
              />
            </div>

            {/* Skills Need Work */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-orange-600">!</span> Skills That Need More Work
              </label>
              <SkillTagSelector
                selectedTags={feedback.skills_need_work}
                onChange={(tags) => updateField('skills_need_work', tags)}
                maxTags={10}
                placeholder="Select skills that need more attention..."
              />
            </div>

            {/* Next Session Focus */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📌 Recommended Focus for Next Session
              </label>
              <SkillTagSelector
                selectedTags={feedback.next_session_focus}
                onChange={(tags) => updateField('next_session_focus', tags)}
                maxTags={5}
                placeholder="What should the next session focus on?"
              />
            </div>
          </div>
        )}

        {/* HOMEWORK SECTION */}
        {activeSection === 'homework' && (
          <div className="space-y-6">
            {/* Homework Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Assign Homework</h4>
                <p className="text-sm text-gray-600">Did you assign any practice work?</p>
              </div>
              <button
                type="button"
                onClick={() => updateField('homework_assigned', !feedback.homework_assigned)}
                className={`
                  relative w-14 h-7 rounded-full transition-colors
                  ${feedback.homework_assigned ? 'bg-pink-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform
                    ${feedback.homework_assigned ? 'translate-x-7' : ''}
                  `}
                />
              </button>
            </div>

            {feedback.homework_assigned && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Homework Topic
                  </label>
                  <input
                    type="text"
                    value={feedback.homework_topic}
                    onChange={(e) => updateField('homework_topic', e.target.value)}
                    placeholder="e.g., Practice 'th' sounds"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Homework Description
                  </label>
                  <textarea
                    value={feedback.homework_description}
                    onChange={(e) => updateField('homework_description', e.target.value)}
                    placeholder="Describe what the child should practice at home..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* NOTES & FLAGS SECTION */}
        {activeSection === 'notes' && (
          <div className="space-y-6">
            {/* Coach Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Notes (Internal)
              </label>
              <textarea
                value={feedback.coach_notes}
                onChange={(e) => updateField('coach_notes', e.target.value)}
                placeholder="Any additional notes about this session..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            {/* Concerns */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4 inline mr-1 text-orange-500" />
                Concerns Noted
              </label>
              <textarea
                value={feedback.concerns_noted}
                onChange={(e) => updateField('concerns_noted', e.target.value)}
                placeholder="Any concerns about the child's progress or behavior..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            {/* Flag for Attention */}
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-red-900">🚩 Flag for Attention</h4>
                  <p className="text-sm text-red-700">Alert admin about this child</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('flagged_for_attention', !feedback.flagged_for_attention)}
                  className={`
                    relative w-14 h-7 rounded-full transition-colors
                    ${feedback.flagged_for_attention ? 'bg-red-500' : 'bg-gray-300'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform
                      ${feedback.flagged_for_attention ? 'translate-x-7' : ''}
                    `}
                  />
                </button>
              </div>

              {feedback.flagged_for_attention && (
                <input
                  type="text"
                  value={feedback.flag_reason}
                  onChange={(e) => updateField('flag_reason', e.target.value)}
                  placeholder="Reason for flagging..."
                  className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                />
              )}
            </div>

            {/* Parent Communication */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <h4 className="font-medium text-blue-900">📞 Parent Communication Needed</h4>
                <p className="text-sm text-blue-700">Mark if you need to discuss with parent</p>
              </div>
              <button
                type="button"
                onClick={() => updateField('parent_communication_needed', !feedback.parent_communication_needed)}
                className={`
                  relative w-14 h-7 rounded-full transition-colors
                  ${feedback.parent_communication_needed ? 'bg-blue-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform
                    ${feedback.parent_communication_needed ? 'translate-x-7' : ''}
                  `}
                />
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex justify-between items-center">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            flex items-center gap-2 px-6 py-2 bg-pink-600 text-white rounded-lg
            hover:bg-pink-700 disabled:bg-pink-400 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Feedback
            </>
          )}
        </button>
      </div>
    </form>
  );
}
