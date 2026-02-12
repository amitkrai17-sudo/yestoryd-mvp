'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import type { ChatMessage, ChildData } from './types';

interface RaiTabProps {
  childId: string;
  child: ChildData;
  coachEmail?: string;
}

const QUICK_PROMPTS = [
  'What should I focus on today?',
  'How was last week?',
  'Any parent concerns?',
  'Suggest an activity',
];

export default function RaiTab({ childId, child, coachEmail }: RaiTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/coach/ai-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          childName: child.child_name,
          childAge: child.age,
          primaryFocus: 'reading_fluency',
          skillsPracticed: [],
          highlights: [],
          challenges: [text.trim()],
          focusProgress: 'improved',
          engagementLevel: 'moderate',
        }),
      });

      const data = await res.json();
      const reply = data.suggestion || 'Sorry, I couldn\'t generate a suggestion right now.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-10 h-10 text-[#00ABFF]/40 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">Ask rAI about {child.child_name}</p>
            <p className="text-white/20 text-xs">Get suggestions, check history, or ask for activity ideas</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#00ABFF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-[#00ABFF]" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2.5 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#FF0099] text-white rounded-br-sm'
                  : 'bg-white/5 text-white/80 border border-white/10 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[#FF0099]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-[#FF0099]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[#00ABFF]/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-[#00ABFF]" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-3 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[#00ABFF]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts (only when empty) */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-white/60 border border-white/10 active:bg-white/10 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-3 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder={`Ask about ${child.child_name}...`}
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#00ABFF] min-h-[44px]"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-[#00ABFF] rounded-xl flex items-center justify-center text-white disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
