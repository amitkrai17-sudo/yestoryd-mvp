'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Sparkles, Minimize2, Copy, MessageCircle, Check } from 'lucide-react';

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
  // NEW: For One-Click Parent Update
  initialPrompt?: string;
  autoSend?: boolean;
  onMessageSent?: (message: string) => void;
  sessionContext?: {
    sessionId: string;
    parentPhone: string;
    parentName: string;
    sessionDate: string;
  };
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
    gradient: 'from-[#00abff] to-[#0066cc]',
    gradientHover: 'hover:shadow-[#00abff]/30',
    accent: '#00abff',
    accentBg: 'bg-[#00abff]/10',
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

export function ChatWidget({
  childId,
  childName,
  userRole,
  userEmail,
  initialPrompt,
  autoSend = false,
  onMessageSent,
  sessionContext
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSent = useRef(false);

  const theme = themes[userRole] || themes.parent;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Handle initial prompt - open widget and optionally auto-send
  useEffect(() => {
    if (initialPrompt && !hasAutoSent.current) {
      setIsOpen(true);
      setIsMinimized(false);
      setInput(initialPrompt);

      if (autoSend) {
        hasAutoSent.current = true;
        // Small delay to show the widget first
        setTimeout(() => {
          handleSendWithContent(initialPrompt);
        }, 300);
      }
    }
  }, [initialPrompt, autoSend]);

  const handleSendWithContent = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
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
          message: content.trim(),
          childId,
          userRole,
          userEmail: userEmail,
          chatHistory: messages.slice(-10),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that request.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      onMessageSent?.(assistantMessage.content);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    handleSendWithContent(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy message to clipboard
  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Send via WhatsApp
  const handleWhatsAppSend = async (content: string) => {
    if (!sessionContext) {
      // No session context, just copy to clipboard
      await navigator.clipboard.writeText(content);
      alert('Message copied! No phone number available.');
      return;
    }

    const phone = '91' + sessionContext.parentPhone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(content);

    // Open WhatsApp
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');

    // Mark session as updated
    try {
      await fetch(`/api/coach/sessions/${sessionContext.sessionId}/parent-update`, {
        method: 'POST',
      });
    } catch (e) {
      console.log('Failed to mark session as updated:', e);
    }
  };

  // Closed state - floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r ${theme.gradient} rounded-full shadow-lg ${theme.gradientHover} hover:shadow-xl transition-all flex items-center justify-center z-50`}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-6 right-6 px-4 py-2 bg-gradient-to-r ${theme.gradient} rounded-full shadow-lg ${theme.gradientHover} hover:shadow-xl transition-all flex items-center gap-2 z-50`}
      >
        <Sparkles className="w-4 h-4 text-white" />
        <span className="text-white text-sm font-medium">{theme.label}</span>
        {messages.length > 0 && (
          <span className="bg-white/20 text-white text-xs px-1.5 rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  // Full chat widget
  return (
    <div className="fixed bottom-6 right-6 w-[360px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200">
      {/* Header */}
      <div className={`bg-gradient-to-r ${theme.gradient} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{theme.label}</h3>
            <p className="text-white/70 text-xs">
              {childName ? `Helping with ${childName}` : 'AI Reading Coach'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${theme.gradient} rounded-2xl flex items-center justify-center mb-4`}>
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h4 className="text-gray-800 font-semibold mb-2">How can I help?</h4>
            <p className="text-gray-500 text-sm mb-4">
              {childName 
                ? `Ask me about ${childName}'s reading progress`
                : 'Ask me anything about reading development'
              }
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts[userRole]?.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendWithContent(prompt)}
                  className={`text-xs ${theme.accentBg} rounded-full px-3 py-1.5 hover:opacity-80 transition-opacity`}
                  style={{ color: theme.accent }}
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
                  <div className={`w-7 h-7 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? `bg-gradient-to-r ${theme.gradient} text-white`
                        : 'bg-white text-gray-800 border border-gray-100 shadow-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Action buttons for coach on AI responses */}
                  {message.role === 'assistant' && userRole === 'coach' && (
                    <div className="flex items-center gap-2 ml-1">
                      <button
                        onClick={() => handleCopy(message.id, message.content)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {sessionContext && (
                        <button
                          onClick={() => handleWhatsAppSend(message.content)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                          title="Send via WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className={`w-7 h-7 bg-gradient-to-br ${theme.gradient} rounded-lg flex items-center justify-center`}>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
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
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{
              maxHeight: '80px',
              // @ts-ignore
              '--tw-ring-color': `${theme.accent}33`,
            }}
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