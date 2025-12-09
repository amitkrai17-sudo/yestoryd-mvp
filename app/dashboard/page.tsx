'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Child = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
};

type LearningEvent = {
  id: string;
  event_type: string;
  event_date: string;
  data: Record<string, any>;
  ai_summary: string | null;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Demo child for testing
  const demoChild: Child = {
    id: 'demo-child-id',
    name: 'Demo Child',
    age: 8,
    grade: '3rd',
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch children and events
  useEffect(() => {
    setChildren([demoChild]);
    setSelectedChild(demoChild);
    setEvents([
      {
        id: '1',
        event_type: 'assessment',
        event_date: new Date().toISOString(),
        data: { score: 7, wpm: 85, fluency: 'Good', pronunciation: 'Clear' },
        ai_summary: 'Good reading progress! Speed is improving.',
      },
      {
        id: '2',
        event_type: 'session',
        event_date: new Date(Date.now() - 86400000).toISOString(),
        data: { duration: 30, coach: 'Rucha', notes: 'Worked on phonics' },
        ai_summary: 'Productive session focusing on phonics patterns.',
      },
    ]);
    setLoading(false);
  }, []);

  // Send message to chat API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
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
          childId: selectedChild?.id || demoChild.id,
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that request.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'assessment': return '📊';
      case 'session': return '👩‍🏫';
      case 'handwritten': return '✍️';
      case 'quiz': return '📝';
      case 'milestone': return '🏆';
      default: return '📌';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'assessment': return 'bg-blue-100 text-blue-700';
      case 'session': return 'bg-green-100 text-green-700';
      case 'handwritten': return 'bg-purple-100 text-purple-700';
      case 'quiz': return 'bg-yellow-100 text-yellow-700';
      case 'milestone': return 'bg-pink-100 text-pink-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-pink-50/30">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                <span className="font-bold text-xl text-gray-900">Yestoryd</span>
              </Link>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">Parent Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              {selectedChild && (
                <div className="flex items-center gap-2 bg-pink-50 px-3 py-1.5 rounded-full">
                  <span className="text-pink-500">👧</span>
                  <span className="font-medium text-pink-700">{selectedChild.name}</span>
                </div>
              )}
              <Link
                href="/book"
                className="bg-pink-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-pink-600 transition-colors"
              >
                Book Session
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Progress Overview */}
          <div className="lg:col-span-1 space-y-6">
            {/* Child Card */}
            {selectedChild && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-3xl">
                    👧
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedChild.name}</h2>
                    <p className="text-gray-500">
                      {selectedChild.age} years old • {selectedChild.grade} Grade
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">7/10</p>
                    <p className="text-xs text-blue-500">Latest Score</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">85</p>
                    <p className="text-xs text-green-500">WPM</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📅</span> Recent Activity
              </h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <span className="text-xl">{getEventIcon(event.event_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getEventColor(event.event_type)}`}>
                          {event.event_type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(event.event_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {event.ai_summary || JSON.stringify(event.data).slice(0, 50)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/assessment"
                className="block mt-4 text-center text-pink-500 text-sm font-semibold hover:text-pink-600"
              >
                + Take New Assessment
              </Link>
            </div>
          </div>

          {/* Right Column - AI Chat */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    🤖
                  </div>
                  <div>
                    <h3 className="font-bold">Yestoryd AI Assistant</h3>
                    <p className="text-sm text-white/80">Ask about {selectedChild?.name}&apos;s progress</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">👋</div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Hi! I&apos;m your reading assistant
                    </h4>
                    <p className="text-gray-500 text-sm mb-4">
                      Ask me anything about {selectedChild?.name}&apos;s reading progress
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "How is my child progressing?",
                        "What should we practice at home?",
                        "Explain the last assessment",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-pink-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your child's progress..."
                    className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="bg-pink-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
