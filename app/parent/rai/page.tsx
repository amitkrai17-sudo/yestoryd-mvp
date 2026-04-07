'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles, Send, Star, Pencil, CheckCircle,
  MessageSquare, Clock, ChevronRight,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useParentContext } from '@/app/parent/context';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

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

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const SUGGESTION_CHIPS = [
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

  // Send message to rAI
  const handleSend = (text?: string) => {
    const message = text || chatInput.trim();
    if (!message) return;
    setActivePrompt(message);
    setChatInput('');
  };

  const handleChipClick = (chip: string) => {
    handleSend(chip);
  };

  // Derive insight data
  const topStrength = profile?.key_strengths?.[0] || null;
  const topGrowthArea = profile?.growth_areas?.[0] || null;
  const engagement = profile?.engagement_pattern || null;

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
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-medium text-gray-900">rAI</h1>
            <p className="text-gray-500 text-sm">{childName}&apos;s reading intelligence</p>
          </div>
        </div>

        {/* ============ SECTION 1: ASK rAI ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Ask rAI anything</p>

          {/* Input row */}
          <div className="flex items-center gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`How is ${childName} doing in phonics?`}
              className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] min-h-[42px]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!chatInput.trim()}
              className="w-[42px] h-[42px] bg-[#FF0099] text-white rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-[#E6008A] transition-colors disabled:opacity-40 disabled:hover:bg-[#FF0099]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="px-3 py-1.5 bg-[#FFF5F9] text-[#993556] rounded-full text-xs font-medium hover:bg-[#FFE8F2] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* ============ SECTION 2: TODAY'S INSIGHT ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
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

        {/* ============ SECTION 3: rAI KNOWS ABOUT {CHILD} ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            rAI knows about {childName}
          </p>

          {hasProfile && (topStrength || topGrowthArea || engagement) ? (
            <div className="space-y-4">
              {/* Strongest area */}
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

              {/* Focus area */}
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

              {/* Engagement */}
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

        {/* ============ DIVIDER ============ */}
        <div className="border-t border-gray-100" />

        {/* ============ SECTION 4: SUPPORT (demoted) ============ */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Support</p>
          <div className="space-y-2">
            {/* Submit a request */}
            <Link
              href="/parent/support"
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Submit a request</p>
                <p className="text-xs text-gray-500">For billing, scheduling, or account issues</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>

            {/* WhatsApp us */}
            <a
              href={`https://wa.me/${COMPANY_CONFIG.leadBotWhatsApp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#E8FCF1] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">WhatsApp us</p>
                <p className="text-xs text-gray-500">Quick help from the Yestoryd team</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </a>

            {/* Past requests */}
            <Link
              href="/parent/support"
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Past requests</p>
                <p className="text-xs text-gray-500">View your support history</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          </div>
        </div>
      </div>

      {/* ChatWidget — mounted only when a prompt is active */}
      {activePrompt && (
        <ChatWidget
          key={activePrompt}
          childId={selectedChildId || undefined}
          childName={childName}
          userRole="parent"
          userEmail={parentEmail}
          initialPrompt={activePrompt}
          autoSend
          onClose={() => setActivePrompt(null)}
        />
      )}
    </div>
  );
}
