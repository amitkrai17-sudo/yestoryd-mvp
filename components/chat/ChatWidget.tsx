'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, User, Minimize2 } from 'lucide-react';
import Image from 'next/image';

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

export default function ChatWidget({
  childId,
  childName,
  userRole,
  userEmail,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Quick prompts based on user role
  const quickPrompts = {
    parent: [
      'How is my child progressing?',
      'What should we practice at home?',
      'Explain the latest assessment',
      'Tips for better reading',
    ],
    coach: [
      'Summarize recent progress',
      'Suggest focus areas',
      'Prepare session agenda',
      'Any concerns to address?',
    ],
    admin: [
      'Overview of progress',
      'Session completion rate',
      'Assessment history',
      'Coach notes summary',
    ],
  };

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
          messages: [...messages, userMessage].map((m) => ({
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
        throw new Error(data.error || 'Chat failed');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
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

  // Floating button when closed - White background with purple/pink text
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-white border-2 border-[#7b008b] rounded-full shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-[#7b008b]/5 group"
        aria-label="Open Vedant AI chat"
      >
        <Image 
          src="/images/vedant-mascot.png" 
          alt="Vedant AI" 
          width={32} 
          height={32}
          className="w-8 h-8 rounded-full"
        />
        <span className="font-semibold bg-gradient-to-r from-[#ff0099] to-[#7b008b] bg-clip-text text-transparent hidden sm:inline">
          Ask Vedant AI
        </span>
        <Sparkles className="w-4 h-4 text-[#ff0099] group-hover:animate-pulse" />
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7b008b] to-[#ff0099] rounded-full shadow-lg cursor-pointer hover:shadow-xl transition-all"
        onClick={() => setIsMinimized(false)}
      >
        <Image 
          src="/images/vedant-mascot.png" 
          alt="Vedant AI" 
          width={24} 
          height={24}
          className="w-6 h-6 rounded-full"
        />
        <span className="text-white text-sm font-medium">
          {childName ? `Chat about ${childName}` : 'Vedant AI'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            setIsMinimized(false);
          }}
          className="ml-2 text-white/80 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Full chat window
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header - Purple gradient */}
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#7b008b] to-[#ff0099]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
            <Image 
              src="/images/vedant-mascot.png" 
              alt="Vedant AI" 
              width={36} 
              height={36}
              className="w-9 h-9"
            />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
              Vedant AI
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-normal">
                Beta
              </span>
            </h3>
            <p className="text-white/80 text-xs">
              {childName ? `Helping with ${childName}'s reading` : 'Your Reading Coach'}
            </p>
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
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff0099]/20 to-[#7b008b]/20 flex items-center justify-center mb-4">
              <Image 
                src="/images/vedant-mascot.png" 
                alt="Vedant AI" 
                width={48} 
                height={48}
                className="w-12 h-12"
              />
            </div>
            <h3 className="text-gray-800 font-semibold mb-2">
              Hi! I'm Vedant AI 👋
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {childName
                ? `I can help you understand ${childName}'s reading progress, assessments, and give personalized tips.`
                : 'I can answer questions about reading progress, assessments, and provide learning tips.'}
            </p>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts[userRole].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs bg-white text-gray-600 px-3 py-2 rounded-full border border-gray-200 hover:border-[#7b008b]/30 hover:bg-[#7b008b]/5 hover:text-[#7b008b] transition-colors"
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
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <Image 
                      src="/images/vedant-mascot.png" 
                      alt="Vedant AI" 
                      width={24} 
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#7b008b] to-[#ff0099] text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/images/vedant-mascot.png" 
                    alt="Vedant AI" 
                    width={24} 
                    height={24}
                    className="w-6 h-6"
                  />
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7b008b]" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              childName ? `Ask about ${childName}...` : 'Ask Vedant AI anything...'
            }
            disabled={isLoading}
            className="flex-1 bg-gray-100 border-0 rounded-xl py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7b008b]/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#7b008b] to-[#ff0099] text-white hover:shadow-lg hover:shadow-[#7b008b]/30"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Vedant AI uses your child's data to provide personalized insights
        </p>
      </div>
    </div>
  );
}