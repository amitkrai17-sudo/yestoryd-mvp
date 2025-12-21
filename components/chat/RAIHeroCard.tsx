'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight, MessageCircle } from 'lucide-react';

interface RAIHeroCardProps {
  userName: string;
  contextName?: string; // Child name for parent, or "your students" for coach
  userRole: 'parent' | 'coach' | 'admin';
  onAskClick?: () => void;
  quickPrompts?: string[];
}

const defaultPrompts: Record<string, string[]> = {
  parent: [
    "How is my child doing?",
    "What should we practice at home?",
    "When is the next session?",
  ],
  coach: [
    "Prepare me for my next session",
    "Which student needs attention?",
    "Summarize today's sessions",
  ],
  admin: [
    "Show conversion funnel",
    "Which coaches are top performers?",
    "Revenue summary this month",
  ],
};

const themeColors: Record<string, { gradient: string; bg: string; border: string; text: string }> = {
  parent: {
    gradient: 'from-[#7b008b] to-[#ff0099]',
    bg: 'bg-[#7b008b]/5',
    border: 'border-[#7b008b]/20',
    text: 'text-[#7b008b]',
  },
  coach: {
    gradient: 'from-[#00abff] to-[#0066cc]',
    bg: 'bg-[#00abff]/5',
    border: 'border-[#00abff]/20',
    text: 'text-[#00abff]',
  },
  admin: {
    gradient: 'from-[#1a1a2e] to-[#4a4a6a]',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-700',
  },
};

export default function RAIHeroCard({
  userName,
  contextName,
  userRole,
  onAskClick,
  quickPrompts,
}: RAIHeroCardProps) {
  const [inputValue, setInputValue] = useState('');
  const theme = themeColors[userRole];
  const prompts = quickPrompts || defaultPrompts[userRole];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && onAskClick) {
      onAskClick();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    if (onAskClick) {
      onAskClick();
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getSubtitle = () => {
    switch (userRole) {
      case 'parent':
        return contextName 
          ? `Ask me anything about ${contextName}'s reading progress`
          : 'Ask me anything about your child\'s reading progress';
      case 'coach':
        return 'I can help you prepare sessions, track student progress, and more';
      case 'admin':
        return 'Get instant insights on platform metrics and performance';
      default:
        return 'How can I help you today?';
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${theme.gradient} p-6 md:p-8 text-white shadow-xl`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">rAI Assistant</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">
              {getGreeting()}, {userName.split(' ')[0]}! 👋
            </h2>
            <p className="text-white/80 text-sm md:text-base">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Ask rAI about ${contextName || 'anything'}...`}
              className="w-full px-4 py-3 pr-12 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handlePromptClick(prompt)}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-sm text-white/90 transition-colors flex items-center gap-1.5"
            >
              <MessageCircle className="w-3 h-3" />
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
