// file: app/coach/dashboard/RAIAssistantTab.tsx
// rAI - RAG-powered AI Assistant for coaches
// Auto-detects child mentions, fetches data from database
// Coach can only access their assigned children

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send, User, Loader2, Sparkles, 
  BookOpen, Target, TrendingUp, MessageSquare,
  Lightbulb, FileText, X, RefreshCw
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  childContext?: string; // Which child was this about
}

interface RAIAssistantTabProps {
  coachId: string;
  coachName: string;
}

// 4-Point Star Icon Component (Yestoryd branding)
function StarIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

// Quick prompt suggestions
const QUICK_PROMPTS = [
  "How is Sima progressing?",
  "Prepare me for my next session",
  "Which child needs the most attention?",
  "What should I focus on with struggling readers?",
  "Give me homework ideas for beginners",
  "Tips for engaging reluctant readers",
];

export default function RAIAssistantTab({ coachId, coachName }: RAIAssistantTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/coach/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          coachId,
          coachName,
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
        childContext: data.detectedChild,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Format markdown-style text
  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#FF0099]/5 via-white to-[#00ABFF]/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl">
              <StarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                rAI Assistant
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  RAG Powered
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Ask about your students or get coaching tips
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Clear chat"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            {/* Hero Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-[#FF0099]/20">
              <StarIcon className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Hi {coachName.split(' ')[0]}! I'm rAI 👋
            </h3>
            <p className="text-gray-500 text-sm max-w-md mb-8">
              I have access to all your students' data - assessments, sessions, and progress. 
              Just ask me anything! I'll automatically find the relevant information.
            </p>

            {/* Example Questions */}
            <div className="w-full max-w-xl">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">
                Try asking...
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => selectPrompt(prompt)}
                    className="text-left text-sm bg-white text-gray-700 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#FF0099] hover:bg-[#FF0099]/5 transition group"
                  >
                    <span className="text-[#FF0099] mr-2 group-hover:mr-3 transition-all">→</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 w-full max-w-2xl">
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center hover:shadow-md transition">
                <Target className="w-6 h-6 text-[#FF0099] mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-700">Session Prep</p>
                <p className="text-[10px] text-gray-400 mt-1">Plan effective sessions</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center hover:shadow-md transition">
                <TrendingUp className="w-6 h-6 text-[#00ABFF] mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-700">Progress Insights</p>
                <p className="text-[10px] text-gray-400 mt-1">Track improvements</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center hover:shadow-md transition">
                <Lightbulb className="w-6 h-6 text-[#FFDE00] mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-700">Recommendations</p>
                <p className="text-[10px] text-gray-400 mt-1">Personalized tips</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center hover:shadow-md transition">
                <FileText className="w-6 h-6 text-[#7B008B] mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-700">Homework Ideas</p>
                <p className="text-[10px] text-gray-400 mt-1">Age-appropriate tasks</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-9 h-9 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <StarIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white shadow-md'
                      : 'bg-white border border-gray-100 text-gray-800 shadow-sm'
                  }`}
                >
                  {message.childContext && message.role === 'assistant' && (
                    <div className="flex items-center gap-1 text-[10px] text-[#FF0099] mb-2 font-medium">
                      <span>📊 About {message.childContext}</span>
                    </div>
                  )}
                  <div 
                    className="text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                  <p className={`text-[10px] mt-2 ${message.role === 'user' ? 'text-pink-200' : 'text-gray-400'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl flex items-center justify-center shadow-sm">
                  <StarIcon className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#FF0099] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-[#FF0099] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-[#FF0099] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your students or coaching tips..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099] text-gray-900 bg-gray-50 placeholder:text-gray-400"
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3.5 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-md shadow-[#FF0099]/20"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          rAI uses your students' data to provide personalized insights • Only your assigned students
        </p>
      </div>
    </div>
  );
}
