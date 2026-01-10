'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Phone, MessageCircle, Mail, ArrowLeft, Send, CheckCircle, 
  User, Clock, Target, Sparkles
} from 'lucide-react';

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
  child?: {
    id: string;
    child_name: string;
    age: number;
    latest_assessment_score: number;
    assessment_wpm: number;
    phonics_focus: string;
    struggling_phonemes: string[];
  };
  status: string;
  scheduled_at: string | null;
  meeting_url: string | null;
  questionnaire: any;
  payment_link: string | null;
  payment_link_sent_at: string | null;
  followup_sent_at: string | null;
  converted_to_enrollment: boolean;
  coach?: {
    name: string;
    email: string;
    phone: string;
  };
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

export default function CoachDiscoveryCallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<DiscoveryCall | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [closingPrompts, setClosingPrompts] = useState<string[]>([]);
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
      if (data.success) {
        setCall(data.call);
        setSuggestedQuestions(data.suggestedQuestions || []);
        setClosingPrompts(data.closingPrompts || []);
        
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
          <p className="text-gray-500 mb-4">Discovery call not found</p>
          <button onClick={() => router.back()} className="text-pink-600 font-medium">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{call.child_name}</h1>
            <p className="text-sm text-gray-500 truncate">{call.parent_name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-pink-600">{call.child?.latest_assessment_score}</p>
            <p className="text-xs text-gray-400">Score</p>
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
        <div className="flex border-t">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'questions' 
                ? 'border-pink-600 text-pink-600 bg-pink-50' 
                : 'border-transparent text-gray-500'
            }`}
          >
            <Sparkles className="w-4 h-4 inline-block mr-1" />
            AI Questions
          </button>
          <button
            onClick={() => setActiveTab('questionnaire')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'questionnaire' 
                ? 'border-pink-600 text-pink-600 bg-pink-50' 
                : 'border-transparent text-gray-500'
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
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-pink-600">{call.child?.latest_assessment_score}</p>
              <p className="text-xs text-gray-500">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{call.child?.assessment_wpm || '-'}</p>
              <p className="text-xs text-gray-500">WPM</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{call.child?.age}</p>
              <p className="text-xs text-gray-500">Age</p>
            </div>
          </div>
        </div>

        {/* AI Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Suggested Questions */}
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border border-pink-100 p-4">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-600" />
                Ask During Call
              </h2>
              <div className="space-y-2">
                {suggestedQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-pink-100">
                    <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-gray-700 text-sm">{q.replace(/"/g, '')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing Prompts */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 p-4">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Closing Scripts
              </h2>
              <div className="space-y-2">
                {closingPrompts.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-blue-100">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-gray-700 text-sm">{p.replace(/"/g, '')}</span>
                  </div>
                ))}
              </div>
            </div>

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
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Call Status *</label>
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
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      callStatus === status.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-gray-300'
                    }`}>
                      {callStatus === status.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{status.label}</p>
                      <p className="text-xs text-gray-500">{status.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Frequency - Radio */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      questionnaire.reading_frequency === opt.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-gray-300'
                    }`}>
                      {questionnaire.reading_frequency === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Child Attitude - Radio */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      questionnaire.child_attitude === opt.value
                        ? 'border-pink-500 bg-pink-500'
                        : 'border-gray-300'
                    }`}>
                      {questionnaire.child_attitude === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Likelihood to Enroll - Radio */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                        ? `border-${opt.color}-500 bg-${opt.color}-50`
                        : 'border-gray-200 bg-white'
                    } ${questionnaire.likelihood_to_enroll === opt.value ? 
                      opt.color === 'green' ? 'border-green-500 bg-green-50' :
                      opt.color === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                      'border-red-500 bg-red-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Parent Goal */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent's goal for {call.child_name}
              </label>
              <input
                type="text"
                value={questionnaire.parent_goal}
                onChange={(e) => setQuestionnaire({ ...questionnaire, parent_goal: e.target.value })}
                placeholder="e.g., improve reading speed, build confidence..."
                className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white"
              />
            </div>

            {/* Objections - Checkboxes */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                        ? 'bg-pink-100 text-pink-700 border-2 border-pink-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                    }`}
                  >
                    {obj.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach Notes */}
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your notes
              </label>
              <textarea
                value={questionnaire.coach_notes}
                onChange={(e) => setQuestionnaire({ ...questionnaire, coach_notes: e.target.value })}
                rows={3}
                placeholder="Your observations and notes..."
                className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-2">
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
          <div className="w-full py-3 bg-green-100 text-green-700 rounded-xl font-medium text-center flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Enrolled Successfully!
          </div>
        )}
      </div>
    </div>
  );
}








