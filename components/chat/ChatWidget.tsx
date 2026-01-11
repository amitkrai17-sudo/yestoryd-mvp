'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Minimize2, Send, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  childId?: string;
  childName?: string;
  userRole: 'parent' | 'coach' | 'admin';
  userEmail: string;
}

const quickPrompts: Record<string, string[]> = {
  parent: [
    "How is my child doing?",
    "What should we practice?",
    "When is the next session?",
  ],
  coach: [
    "Prepare me for next session",
    "Which student needs attention?",
    "Summarize today's progress",
  ],
  admin: [
    "Show enrollment stats",
    "Top performing coaches",
    "Revenue this month",
  ],
};

// Theme colors per role
const themes: Record<string, {
  gradient: string;
  gradientHover: string;
  accent: string;
  accentBg: string;
  label: string;
}> = {
  parent: {
    gradient: 'from-[#7b008b] to-[#ff0099]',
    gradientHover: 'hover:shadow-[#7b008b]/30',
    accent: '#7b008b',
    accentBg: 'bg-[#7b008b]/10',
    label: 'rAI',
  },
  coach: {
    gradient: 'from-[#FF0099] to-[#7B008B]',
    gradientHover: 'hover:shadow-[#FF0099]/30',
    accent: '#FF0099',
    accentBg: 'bg-[#FF0099]/10',
    label: 'rAI Coach',
  },
  admin: {
    gradient: 'from-[#1a1a2e] to-[#4a4a6a]',
    gradientHover: 'hover:shadow-slate-500/30',
    accent: '#1a1a2e',
    accentBg: 'bg-slate-100',
    label: 'rAI Admin',
  },
};

// rAI Mascot Component - reusable across the widget
function RAIMascot({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: { width: 20, height: 20, container: 'w-7 h-7' },
    md: { width: 28, height: 28, container: 'w-9 h-9' },
    lg: { width: 32, height: 32, container: 'w-12 h-12' },
  };
  
  const s = sizes[size];
  
  return (
    <div className={`${s.container} rounded-xl flex items-center justify-center overflow-hidden ${className}`}>
      <Image
        src="/images/rai-mascot.png"
        alt="rAI"
        width={s.width}
        height={s.height}
        className="object-contain"
      />
    </div>
  );
}

export function ChatWidget({ childId, childName, userRole, userEmail }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const theme = themes[userRole] || themes.parent;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          chatHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          childId,
          userRole,
          userEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support on WhatsApp.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const getContextLabel = () => {
    if (userRole === 'parent' && childName) return `Helping with ${childName}`;
    if (userRole === 'coach') return 'Coaching Assistant';
    if (userRole === 'admin') return 'Platform Insights';
    return 'Reading Assistant';
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 pl-2 pr-4 py-2 bg-gradient-to-r ${theme.gradient} text-white rounded-full shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl ${theme.gradientHover}`}
        aria-label={`Open ${theme.label} chat`}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
          <Image
            src="/images/rai-mascot.png"
            alt="rAI"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
        <span className="font-medium text-sm">{theme.label}</span>
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 pl-2 pr-4 py-2 bg-gradient-to-r ${theme.gradient} text-white rounded-full shadow-lg hover:shadow-xl transition-all`}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
          <Image
            src="/images/rai-mascot.png"
            alt="rAI"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
        <span className="text-sm font-medium">{theme.label}</span>
      </button>
    );
  }

  // Full chat window
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header */}
      <div className={`bg-gradient-to-r ${theme.gradient} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
            <Image
              src="/images/rai-mascot.png"
              alt="rAI"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{theme.label}</h3>
            <p className="text-white/80 text-xs">{getContextLabel()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsMinimized(false);
            }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className={`w-16 h-16 ${theme.accentBg} rounded-2xl flex items-center justify-center mb-4 overflow-hidden`}>
              <Image
                src="/images/rai-mascot.png"
                alt="rAI"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <h3 className="text-gray-800 font-semibold mb-2 text-sm">
              {userRole === 'parent' && childName ? `Ask about ${childName}` : 'How can I help?'}
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              {userRole === 'parent' && childName
                ? `I have access to ${childName}'s progress data.`
                : userRole === 'coach'
                ? 'I can help with session prep, student insights, and more.'
                : userRole === 'admin'
                ? 'Ask me about platform metrics and insights.'
                : 'Ask me anything about reading progress.'}
            </p>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts[userRole].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs bg-white text-gray-600 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className={`w-8 h-8 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                    <Image
                      src="/images/rai-mascot.png"
                      alt="rAI"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    message.role === 'user'
                      ? `bg-gradient-to-r ${theme.gradient} text-white`
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className={`w-8 h-8 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center overflow-hidden`}>
                  <Image
                    src="/images/rai-mascot.png"
                    alt="rAI"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.accent }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about reading progress..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all"
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-2.5 bg-gradient-to-r ${theme.gradient} text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatWidget;
