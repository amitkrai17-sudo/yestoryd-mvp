// ============================================================
// CaptureChat — Conversational session debrief with rAI
// Coach chats naturally → Gemini extracts structured capture data
// → Form opens pre-filled for review + artifact upload + submit
// ============================================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Send, X, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { readChatSSE } from '@/lib/rai/sse-client';
import { safeParseGeminiJSON } from '@/lib/gemini/safe-parse';
import type { CaptureFormState, SkillRating } from './types';

export interface ExtractedCaptureData extends Partial<CaptureFormState> {
  _fromChat: true;
}

interface CaptureChatProps {
  sessionId: string;
  childId: string;
  childName: string;
  childAge: number;
  coachId: string;
  sessionModality: string;
  childProfile: any;
  activeContinuations: Array<{ id: string; observation_text: string }>;
  skillCategories: Array<{ id: string; label: string; skills: Array<{ id: string; name: string; skillTag: string }> }>;
  onComplete: (data: ExtractedCaptureData) => void;
  onCancel: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function CaptureChat({
  sessionId, childId, childName, childAge, coachId,
  sessionModality, childProfile, activeContinuations, skillCategories,
  onComplete, onCancel,
}: CaptureChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [extractionReceived, setExtractionReceived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send first message on mount
  useEffect(() => {
    sendToAPI([]);
  }, []);

  const sendToAPI = useCallback(async (chatHistory: ChatMessage[]) => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/intelligence/capture-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory.map(m => ({ role: m.role, content: m.content })),
          childName, childAge, childProfile,
          activeContinuations, skillCategories, sessionModality,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let fullText = '';
      await readChatSSE(res, {
        onStatus: () => {},
        onChunk: (text) => {
          fullText += text;
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], content: fullText };
            } else {
              updated.push({ id: crypto.randomUUID(), role: 'assistant', content: fullText });
            }
            return updated;
          });
        },
        onResponse: (content) => {
          fullText = content;
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content }]);
        },
        onChildren: () => {},
        onDone: () => {
          // Check if the response contains extraction data
          checkForExtraction(fullText);
        },
        onError: (msg) => {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: msg || 'Something went wrong. Please try again.' }]);
        },
      });
    } catch (err) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [childName, childAge, childProfile, activeContinuations, skillCategories, sessionModality]);

  const checkForExtraction = useCallback((content: string) => {
    const hasCaptureData = content.includes('CAPTURE_DATA');
    console.log('[CaptureChat] Checking extraction. Has CAPTURE_DATA:', hasCaptureData, 'Content length:', content.length);

    const captureMatch = content.match(/---CAPTURE_DATA---([\s\S]*?)---END_CAPTURE---/);
    if (!captureMatch) {
      if (hasCaptureData) {
        console.log('[CaptureChat] CAPTURE_DATA found but regex failed. Last 300 chars:', content.slice(-300));
      }
      return;
    }

    console.log('[CaptureChat] Extraction JSON raw:', captureMatch[1].substring(0, 200));
    const parsed = safeParseGeminiJSON(captureMatch[1]);
    if (!parsed?.ready) {
      console.log('[CaptureChat] Parsed but ready=false or parse failed:', parsed);
      return;
    }

    console.log('[CaptureChat] Extraction successful. Keys:', Object.keys(parsed));
    setExtractionReceived(true);

    // Clean the visible message (remove JSON block)
    const visibleText = content.replace(/---CAPTURE_DATA---[\s\S]*?---END_CAPTURE---/, '').trim();
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: visibleText };
      }
      return updated;
    });

    // Map extraction to form state after a brief pause
    setTimeout(() => {
      const formData = mapToFormState(parsed);
      onComplete(formData);
    }, 2000);
  }, [onComplete, skillCategories]);

  const mapToFormState = useCallback((extraction: any): ExtractedCaptureData => {
    console.log('[CaptureChat] Mapping extraction:', JSON.stringify(extraction).substring(0, 500));

    const selectedSkillIds: string[] = [];
    const skillPerformances: Record<string, { rating: SkillRating | null; note: string }> = {};

    const ratingMap: Record<string, SkillRating> = {
      emerging: 'struggling', struggling: 'struggling',
      developing: 'developing',
      proficient: 'proficient',
      advanced: 'advanced', mastered: 'advanced',
    };

    for (const skill of extraction.skills || []) {
      for (const cat of skillCategories) {
        const match = cat.skills?.find((s: any) =>
          s.name.toLowerCase().includes((skill.name || '').toLowerCase()) ||
          s.skillTag === skill.slug ||
          (skill.name || '').toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
          selectedSkillIds.push(match.id);
          const rating = ratingMap[(skill.rating || '').toLowerCase()] || null;
          skillPerformances[match.id] = { rating, note: '' };
          break;
        }
      }
    }

    const engagementMap: Record<string, string> = { low: 'low', moderate: 'moderate', medium: 'moderate', high: 'high', exceptional: 'exceptional' };

    // Robust field mapping — handle multiple possible field names from Gemini
    const strengthNote = extraction.strengthSummary || extraction.strength_summary ||
      extraction.strengthNotes || extraction.strength_notes ||
      (Array.isArray(extraction.strengths) ? extraction.strengths.join('. ') : '') || '';
    const struggleNote = extraction.struggleSummary || extraction.struggle_summary ||
      extraction.struggleNotes || extraction.struggle_notes ||
      (Array.isArray(extraction.struggles) ? extraction.struggles.join('. ') : '') || '';
    const homework = extraction.homework || extraction.homework_suggestion ||
      extraction.homeworkSuggestion || extraction.homeworkDescription || '';
    const engagement = extraction.engagement || extraction.engagement_level ||
      extraction.engagementLevel || 'moderate';

    const result: ExtractedCaptureData = {
      _fromChat: true,
      selectedSkillIds,
      skillPerformances,
      customStrengthNote: strengthNote,
      customStruggleNote: struggleNote,
      wordsMastered: extraction.wordsMastered || extraction.words_mastered || [],
      wordsStruggled: extraction.wordsStruggled || extraction.words_struggled || [],
      engagementLevel: (engagementMap[engagement.toLowerCase()] || 'moderate') as any,
      homeworkAssigned: !!homework,
      homeworkDescription: homework,
    };

    console.log('[CaptureChat] Mapped result:', { skills: selectedSkillIds.length, strengthNote: strengthNote.substring(0, 50), struggleNote: struggleNote.substring(0, 50), homework: homework.substring(0, 50) });
    return result;
  }, [skillCategories]);

  // Count coach messages for safety valve
  const coachMessageCount = messages.filter(m => m.role === 'user').length;

  // Safety valve: if 8+ coach messages and no extraction, force it
  useEffect(() => {
    if (coachMessageCount >= 8 && !extractionReceived && !isLoading) {
      const forceMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: 'Please generate the session report now with whatever information you have.',
      };
      setMessages(prev => [...prev, forceMsg]);
      sendToAPI([...messages, forceMsg]);
    }
  }, [coachMessageCount, extractionReceived, isLoading]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setInterimTranscript('');

    sendToAPI(updatedMessages);
  }, [input, isLoading, messages, sendToAPI]);

  // Voice input via Web Speech API
  const toggleVoice = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    const win = window as any;
    const SpeechRecognitionCtor = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert('Voice input requires Chrome browser');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      if (finalText) {
        setInput(prev => (prev + ' ' + finalText).trim());
      }
      setInterimTranscript(interim);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
        setIsRecording(false);
        // Auto-send after silence
        setTimeout(() => {
          const currentInput = (document.querySelector('[data-capture-input]') as HTMLInputElement)?.value;
          if (currentInput?.trim()) sendMessage();
        }, 100);
      }, 3000);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording, sendMessage]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#00ABFF] to-[#7C3AED] px-3 py-2.5 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-sm truncate flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Session Debrief
            </h2>
            <p className="text-white/50 text-[11px]">
              {childName} · Q{Math.min(coachMessageCount + 1, 7)} of 7
            </p>
          </div>
          <div className="flex items-center gap-3">
            {coachMessageCount >= 2 && !extractionReceived && (
              <button
                onClick={() => {
                  const forceMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: "That's everything. Please generate my report." };
                  const updated = [...messages, forceMsg];
                  setMessages(updated);
                  sendToAPI(updated);
                }}
                className="text-xs text-cyan-300 hover:text-white transition-colors"
              >
                Generate report
              </button>
            )}
            <button onClick={onCancel} className="text-xs text-white/40 hover:text-white/60">
              Skip to form
            </button>
            <button onClick={onCancel} className="p-1.5 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* First-load instruction */}
      {coachMessageCount === 0 && !isLoading && messages.length <= 1 && (
        <div className="px-4 py-2 text-[11px] text-white/30 text-center">
          Answer a few questions about the session. Tap &ldquo;Generate report&rdquo; anytime when you&rsquo;re ready.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#00ABFF] text-white'
                : 'bg-white/10 text-white/90'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-[#00ABFF] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-white/10 bg-gray-950 safe-area-bottom">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            className={`p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/10'
            }`}
          >
            {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white/60" />}
          </button>
          <input
            ref={inputRef}
            data-capture-input
            value={input + (interimTranscript ? ` ${interimTranscript}` : '')}
            onChange={e => { setInput(e.target.value); setInterimTranscript(''); }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type or tap mic to speak..."
            className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-white text-base placeholder:text-white/30 outline-none border border-white/10 focus:border-[#00ABFF]/50 min-h-[44px]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-[#00ABFF] rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1 mt-2 px-2">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
            <span className="text-xs text-red-400 ml-2">Listening...</span>
          </div>
        )}
      </div>
    </div>
  );
}
