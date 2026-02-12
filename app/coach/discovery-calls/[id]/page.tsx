'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Phone, MessageCircle, Mail, ArrowLeft, Send, CheckCircle,
  User, Clock, Target, Sparkles, Heart
} from 'lucide-react';
import { LEARNING_GOALS, LearningGoalId } from '@/lib/constants/goals';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface DiscoveryCall {
  id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  child_age: number;
  assessment_score: number;
  assessment_wpm: number;
  assessment_feedback: string;
  status: string;
  scheduled_at: string | null;
  meeting_url: string | null;
  questionnaire: any;
  payment_link: string | null;
  payment_link_sent_at: string | null;
  followup_sent_at: string | null;
  converted_to_enrollment: boolean;
  assigned_coach?: {
    name: string;
    email: string;
    phone: string;
  };
  // Parent goals from children table
  parent_goals?: string[];
  goals_captured_at?: string;
  goals_capture_method?: string;
}

interface QuestionnaireForm {
  reading_frequency: string;
  child_attitude: string;
  parent_goal: string;
  previous_support: string;
  preferred_session_time: string;
  specific_concerns: string;
  likelihood_to_enroll: string;
  objections: string[];
  objection_details: string;
  coach_notes: string;
}

interface AIQuestion {
  category: string;
  question: string;
  priority: string;
}

export default function CoachDiscoveryCallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<DiscoveryCall | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPayment, setSendingPayment] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'questionnaire'>('questions');

  const [callStatus, setCallStatus] = useState('completed');
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireForm>({
    reading_frequency: '',
    child_attitude: '',
    parent_goal: '',
    previous_support: '',
    preferred_session_time: '',
    specific_concerns: '',
    likelihood_to_enroll: '',
    objections: [],
    objection_details: '',
    coach_notes: '',
  });

  useEffect(() => {
    fetchCall();
  }, [callId]);

  const fetchCall = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discovery-call/${callId}`);
      const data = await res.json();
      
      if (res.ok && data.call) {
        setCall(data.call);
        setAiQuestions(data.aiQuestions || []);
        
        if (data.call.questionnaire && Object.keys(data.call.questionnaire).length > 0) {
          setQuestionnaire({
            ...questionnaire,
            ...data.call.questionnaire,
          });
          setActiveTab('questionnaire');
        }
        
        if (data.call.status !== 'pending' && data.call.status !== 'scheduled') {
          setCallStatus(data.call.status);
        }
      }
    } catch (error) {
      console.error('Error fetching call:', error);
    }
    setLoading(false);
  };

  const saveQuestionnaire = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/discovery-call/${callId}/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callStatus,
          questionnaire,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Questionnaire saved!');
        fetchCall();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving questionnaire');
    }
    setSaving(false);
  };

  const sendPaymentLink = async () => {
    setSendingPayment(true);
    try {
      const res = await fetch(`/api/discovery-call/${callId}/send-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        if (data.waLink) {
          window.open(data.waLink, '_blank');
        }
        alert('Payment link sent!');
        fetchCall();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error sending payment link');
    }
    setSendingPayment(false);
  };

  const sendFollowup = async () => {
    setSendingFollowup(true);
    try {
      const res = await fetch(`/api/discovery-call/${callId}/send-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        if (data.waLink) {
          window.open(data.waLink, '_blank');
        }
        alert('Follow-up sent!');
        fetchCall();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error sending follow-up');
    }
    setSendingFollowup(false);
  };

  const handleObjectionChange = (objection: string) => {
    setQuestionnaire((prev) => ({
      ...prev,
      objections: prev.objections.includes(objection)
        ? prev.objections.filter((o) => o !== objection)
        : [...prev.objections, objection],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-text-tertiary mb-4">Discovery call not found</p>
          <button onClick={() => router.back()} className="text-pink-600 font-medium">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-surface-2 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-text-tertiary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white truncate">{call.child_name}</h1>
            <p className="text-sm text-text-tertiary truncate">{call.parent_name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-pink-600">{call.assessment_score || '-'}</p>
            <p className="text-xs text-text-tertiary">Score</p>
          </div>
        </div>

        {/* Quick Contact - Sticky */}
        <div className="flex gap-2 px-4 pb-3">
          <a 
            href={`tel:${call.parent_phone}`}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
          <a 
            href={`https://wa.me/91${(call.parent_phone || '').replace(/\D/g, '')}`}
            target="_blank"
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-t border-border">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'questions' 
                ? 'border-pink-600 text-pink-600 bg-surface-2' 
                : 'border-transparent text-text-tertiary bg-surface-1'
            }`}
          >
            <Sparkles className="w-4 h-4 inline-block mr-1" />
            AI Questions
          </button>
          <button
            onClick={() => setActiveTab('questionnaire')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'questionnaire' 
                ? 'border-pink-600 text-pink-600 bg-surface-2' 
                : 'border-transparent text-text-tertiary bg-surface-1'
            }`}
          >
            <Target className="w-4 h-4 inline-block mr-1" />
            Questionnaire
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Child Info Card */}
        <div className="bg-surface-1 rounded-xl border p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-pink-600">{call.assessment_score || '-'}</p>
              <p className="text-xs text-text-tertiary">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{call.assessment_wpm || '-'}</p>
              <p className="text-xs text-text-tertiary">WPM</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{call.child_age}</p>
              <p className="text-xs text-text-tertiary">Age</p>
            </div>
          </div>
          {call.child_age >= 4 && call.child_age <= 12 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-center">
              <AgeBandBadge age={call.child_age} size="md" showEmoji />
            </div>
          )}
        </div>

        {/* Parent Goals */}
        <div className="bg-surface-1 rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Parent Goals
            </h3>
            {call.goals_capture_method && (
              <span className="text-xs text-text-tertiary bg-gray-700 px-2 py-1 rounded">
                via {call.goals_capture_method.replace('_', ' ')}
              </span>
            )}
          </div>

          {call.parent_goals && call.parent_goals.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {call.parent_goals.map((goalId) => {
                  const goal = LEARNING_GOALS[goalId as LearningGoalId];
                  if (!goal) return null;

                  return (
                    <span
                      key={goalId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5
                                 bg-pink-900/30 border border-pink-600/30
                                 rounded-full text-sm text-white"
                    >
                      <span>{goal.emoji}</span>
                      <span>{goal.label}</span>
                    </span>
                  );
                })}
              </div>
              {call.goals_captured_at && (
                <p className="text-xs text-text-tertiary mt-3">
                  Captured {new Date(call.goals_captured_at).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-text-tertiary text-sm italic">
              Not captured yet — explore during call
            </p>
          )}
        </div>

        {/* AI Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {aiQuestions.length > 0 ? (
              <div className="bg-surface-1 rounded-xl border border-border p-4">
                <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-600" />
                  AI-Generated Questions
                </h2>
                <div className="space-y-2">
                  {aiQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 bg-surface-2 rounded-lg p-3 border border-border">
                      <span className="w-6 h-6 bg-pink-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs text-pink-500 font-medium mb-1">{q.category}</p>
                        <p className="text-text-secondary text-sm">{q.question}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-surface-1 rounded-xl border border-border p-6 text-center">
                <Sparkles className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
                <p className="text-text-tertiary">No AI questions available yet</p>
              </div>
            )}

            {/* Go to Questionnaire Button */}
            <button
              onClick={() => setActiveTab('questionnaire')}
              className="w-full py-3 bg-pink-600 text-white rounded-xl font-medium"
            >
              Fill Questionnaire →
            </button>
          </div>
        )}

        {/* Questionnaire Tab */}
        {activeTab === 'questionnaire' && (
          <div className="space-y-4">
            {/* Call Status - Radio Buttons */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">Call Status *</label>
              <div className="space-y-2">
                {[
                  { value: 'completed', label: '✅ Completed', desc: 'Call finished successfully' },
                  { value: 'no_show', label: '❌ No Show', desc: 'Parent did not attend' },
                  { value: 'rescheduled', label: '📅 Rescheduled', desc: 'Call moved to another time' },
                ].map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setCallStatus(status.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      callStatus === status.value
                        ? 'border-pink-500 bg-surface-2'
                        : 'border-border bg-surface-1'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      callStatus === status.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-border'
                    }`}>
                      {callStatus === status.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{status.label}</p>
                      <p className="text-xs text-text-tertiary">{status.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Frequency - Radio */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                How often does {call.child_name} read?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'rarely', label: '📚 Rarely', desc: 'Once a week or less' },
                  { value: 'sometimes', label: '📖 Sometimes', desc: 'Few times a week' },
                  { value: 'daily', label: '🌟 Daily', desc: 'Every day' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuestionnaire({ ...questionnaire, reading_frequency: opt.value })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      questionnaire.reading_frequency === opt.value
                        ? 'border-pink-500 bg-surface-2'
                        : 'border-border bg-surface-1'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      questionnaire.reading_frequency === opt.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-border'
                    }`}>
                      {questionnaire.reading_frequency === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{opt.label}</p>
                      <p className="text-xs text-text-tertiary">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Child Attitude - Radio */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Child's attitude toward reading
              </label>
              <div className="space-y-2">
                {[
                  { value: 'resistant', label: '😟 Resistant', desc: 'Avoids or dislikes reading' },
                  { value: 'neutral', label: '😐 Neutral', desc: 'Neither enjoys nor dislikes' },
                  { value: 'enjoys', label: '😊 Enjoys', desc: 'Likes reading' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuestionnaire({ ...questionnaire, child_attitude: opt.value })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      questionnaire.child_attitude === opt.value
                        ? 'border-pink-500 bg-surface-2'
                        : 'border-border bg-surface-1'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      questionnaire.child_attitude === opt.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-border'
                    }`}>
                      {questionnaire.child_attitude === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{opt.label}</p>
                      <p className="text-xs text-text-tertiary">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Likelihood to Enroll - Radio */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Likelihood to enroll
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'high', label: '🔥 High', color: 'green' },
                  { value: 'medium', label: '⚡ Medium', color: 'yellow' },
                  { value: 'low', label: '❄️ Low', color: 'red' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuestionnaire({ ...questionnaire, likelihood_to_enroll: opt.value })}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all text-center ${
                      questionnaire.likelihood_to_enroll === opt.value
                        ? opt.color === 'green' ? 'border-green-500 bg-green-900' :
                          opt.color === 'yellow' ? 'border-yellow-500 bg-yellow-900' :
                          'border-red-500 bg-red-900'
                        : 'border-border bg-surface-1'
                    }`}
                  >
                    <p className="font-medium text-white">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Parent Goal */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Parent's goal for {call.child_name}
              </label>
              <input
                type="text"
                value={questionnaire.parent_goal}
                onChange={(e) => setQuestionnaire({ ...questionnaire, parent_goal: e.target.value })}
                placeholder="e.g., improve reading speed, build confidence..."
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-white bg-surface-2 placeholder-text-tertiary"
              />
            </div>

            {/* Objections - Checkboxes */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Objections raised (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'price', label: '💰 Price' },
                  { value: 'time', label: '⏰ Time' },
                  { value: 'not_sure', label: '🤔 Not sure' },
                  { value: 'want_to_think', label: '💭 Think about it' },
                  { value: 'other', label: '📝 Other' },
                ].map((obj) => (
                  <button
                    key={obj.value}
                    type="button"
                    onClick={() => handleObjectionChange(obj.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      questionnaire.objections.includes(obj.value)
                        ? 'bg-pink-600 text-white border-2 border-pink-500'
                        : 'bg-surface-2 text-text-tertiary border-2 border-border'
                    }`}
                  >
                    {obj.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach Notes */}
            <div className="bg-surface-1 rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Your notes
              </label>
              <textarea
                value={questionnaire.coach_notes}
                onChange={(e) => setQuestionnaire({ ...questionnaire, coach_notes: e.target.value })}
                rows={3}
                placeholder="Your observations and notes..."
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-white bg-surface-2 placeholder-text-tertiary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t p-4 space-y-2">
        {activeTab === 'questionnaire' && (
          <button
            onClick={saveQuestionnaire}
            disabled={saving}
            className="w-full py-3 bg-pink-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Questionnaire
              </>
            )}
          </button>
        )}

        {call.status === 'completed' && !call.payment_link_sent_at && !call.converted_to_enrollment && (
          <button
            onClick={sendPaymentLink}
            disabled={sendingPayment}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sendingPayment ? 'Sending...' : 'Send Payment Link'}
          </button>
        )}

        {call.payment_link_sent_at && !call.followup_sent_at && !call.converted_to_enrollment && (
          <button
            onClick={sendFollowup}
            disabled={sendingFollowup}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {sendingFollowup ? 'Sending...' : 'Send Follow-up'}
          </button>
        )}

        {call.converted_to_enrollment && (
          <div className="w-full py-3 bg-green-500/20 text-green-400 rounded-xl font-medium text-center flex items-center justify-center gap-2 border border-green-500/30">
            <CheckCircle className="w-4 h-4" />
            Enrolled Successfully!
          </div>
        )}
      </div>
    </div>
  );
}