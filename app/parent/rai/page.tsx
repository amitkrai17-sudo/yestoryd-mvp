'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles, Send, Star, Pencil, CheckCircle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useParentContext } from '@/app/parent/context';
import { useChatStream } from '@/lib/hooks/useChatStream';

// ============================================================
// Types
// ============================================================

interface SkillRating {
  skill_name: string;
  rating: string;
  rating_raw: string;
  trend: string;
}

interface IntelligenceProfile {
  overall_reading_level: string;
  narrative_summary: string;
  key_strengths: string[];
  growth_areas: string[];
  skill_ratings: SkillRating[];
  engagement_pattern: string;
  recommended_focus: string | null;
  last_assessed: string;
}

const FOLLOWUP_CHIPS = [
  'What to do next?',
  'Explain more',
  'Practice suggestions',
];

// ============================================================
// Page
// ============================================================

export default function ParentRAIPage() {
  const { selectedChildId, selectedChild, parent, user } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Your Child';
  const parentEmail = parent?.email || user?.email || '';

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profile, setProfile] = useState<IntelligenceProfile | null>(null);

  // Chat: state + send() via shared hook; page still owns input text and UI refs.
  const { messages, statusMessage, isSending, send } = useChatStream({
    userRole: 'parent',
    userEmail: parentEmail,
    childId: selectedChildId ?? undefined,
  });
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const INITIAL_CHIPS = [
    `What should ${childName} practice?`,
    'Reading tips for home',
    'How to build fluency?',
  ];

  const fetchIntelligence = useCallback(async (childId: string) => {
    try {
      const res = await fetch(`/api/parent/intelligence/${childId}`);
      const data = await res.json();
      if (data.success) {
        setHasProfile(data.has_profile);
        if (data.profile) {
          setProfile(data.profile);
        }
      }
    } catch (err) {
      console.error('Intelligence fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchIntelligence(selectedChildId).finally(() => setLoading(false));
  }, [selectedChildId, fetchIntelligence]);

  // Auto-scroll inside the chat card's message container
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, statusMessage]);

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setInput('');
    send(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (ts: Date) =>
    ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Derive insight data
  const topStrength = profile?.key_strengths?.[0] || null;
  const topGrowthArea = profile?.growth_areas?.[0] || null;
  const engagement = profile?.engagement_pattern || null;

  // Index of the latest completed assistant message (for follow-up chips)
  const latestAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();
  const latestAssistant = latestAssistantIdx >= 0 ? messages[latestAssistantIdx] : null;
  const showFollowupChips = !!latestAssistant
    && !latestAssistant.isStreaming
    && !latestAssistant.isError
    && !isSending;

  // Dedup: don't show a follow-up chip matching the most recent user message
  const latestUserMessage = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content.trim().toLowerCase();
    }
    return '';
  })();
  const followupChipsToShow = FOLLOWUP_CHIPS.filter(
    (chip) => chip.trim().toLowerCase() !== latestUserMessage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ============ HEADER ============ */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF0099] to-[#cc007a] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-gray-900">rAI</h1>
            <p className="text-gray-500 text-sm">{childName}&apos;s reading intelligence</p>
          </div>
        </div>

        {/* ============ TODAY'S INSIGHT ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Today&apos;s insight
          </p>

          {hasProfile && profile?.narrative_summary ? (
            <div className="bg-[#FFF5F9] rounded-xl p-4">
              <p className="text-sm text-[#993556] leading-relaxed">
                {profile.narrative_summary}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Based on {childName}&apos;s recent sessions · {profile.last_assessed}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Sparkles className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Complete a few sessions to unlock personalized insights from rAI
              </p>
            </div>
          )}
        </div>

        {/* ============ rAI KNOWS ABOUT {CHILD} ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            <span className="normal-case">rAI</span> knows about {childName}
          </p>

          {hasProfile && (topStrength || topGrowthArea || engagement) ? (
            <div className="space-y-4">
              {topStrength && (
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-[#FF0099] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Strongest area</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {topStrength} — consistently engaged across sessions
                    </p>
                  </div>
                </div>
              )}

              {topGrowthArea && (
                <div className="flex items-start gap-3">
                  <Pencil className="w-4 h-4 text-[#FF0099] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Focus area</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {topGrowthArea} — emerging, needs daily practice
                    </p>
                  </div>
                </div>
              )}

              {engagement && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-[#FF0099] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Engagement</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {engagement} across all sessions
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Sparkles className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                rAI is still learning about {childName}. Insights will appear after 3+ sessions.
              </p>
            </div>
          )}
        </div>

        {/* ============ CHAT CARD ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[60vh] lg:max-h-[500px] overflow-hidden">

          {/* Chat card header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7b008b] to-[#ff0099] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-700">Chat with rAI</p>
          </div>

          {/* Messages (internal scroll) */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.length === 0 ? (
              // Empty state — initial chips
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7b008b] to-[#ff0099] flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">Ask rAI anything</p>
                <p className="text-xs text-gray-500 mb-4">
                  About {childName}&apos;s reading, progress, or what to practice
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-[85%] mx-auto">
                  {INITIAL_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSend(chip)}
                      disabled={isSending}
                      className="px-3 py-1.5 bg-[#FFF5F9] text-[#993556] rounded-full text-xs font-medium hover:bg-[#FFE8F2] transition-colors disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  msg.role === 'user' ? (
                    // User bubble — pastel pink, right
                    <div key={msg.id} className="max-w-[85%] ml-auto flex flex-col items-end">
                      <div className="bg-pink-100 text-gray-800 rounded-2xl rounded-br-md px-4 py-2.5">
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 mr-1">
                        {formatTimestamp(msg.timestamp)}
                      </p>
                    </div>
                  ) : (
                    // rAI bubble — pastel purple, left, with avatar
                    <div key={msg.id} className="flex flex-col gap-1">
                      <div className="flex justify-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7b008b] to-[#ff0099] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="max-w-[85%] flex flex-col items-start">
                          <div className={`rounded-2xl rounded-bl-md px-4 py-2.5 ${
                            msg.isError
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-purple-100 text-purple-900'
                          }`}>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            {msg.isStreaming && (
                              <span className="inline-block w-1.5 h-4 ml-0.5 bg-purple-400 animate-pulse rounded-sm align-middle" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 ml-1">
                            {formatTimestamp(msg.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Follow-up chips — only under the latest completed AI bubble */}
                      {idx === latestAssistantIdx && showFollowupChips && followupChipsToShow.length > 0 && (
                        <div className="flex flex-wrap gap-2 ml-9 mt-2">
                          {followupChipsToShow.map((chip) => (
                            <button
                              key={chip}
                              onClick={() => handleSend(chip)}
                              disabled={isSending}
                              className="px-3 py-1 border border-purple-200 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-50 transition-colors disabled:opacity-50"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ))}

                {/* Typing indicator */}
                {isSending && !messages.some(m => m.isStreaming) && (
                  <div className="flex justify-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7b008b] to-[#ff0099] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-purple-100 rounded-2xl rounded-bl-md px-4 py-3">
                      {statusMessage ? (
                        <p className="text-xs text-purple-700 animate-pulse">{statusMessage}</p>
                      ) : (
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input row (inside card, bottom) */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${childName}'s reading...`}
                rows={1}
                className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] min-h-[44px] max-h-[120px]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isSending}
                className="w-11 h-11 bg-[#FF0099] text-white rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-[#E6008A] transition-colors disabled:opacity-40 disabled:hover:bg-[#FF0099]"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
