// ============================================================
// MicroNotePanel — Floating during-session quick-tap widget
// Minimal UI: 3 buttons (strength/struggle/word), expands on tap
// ============================================================

'use client';

import { useState, useCallback, useRef } from 'react';
import { Star, AlertTriangle, Type, Mic, X } from 'lucide-react';

interface MicroNotePanelProps {
  sessionId: string;
  childId: string;
  childName: string;
  coachId: string;
  sessionStartTime: Date;
  quickStrengths: { id: string; text: string }[];
  quickStruggles: { id: string; text: string }[];
}

export function MicroNotePanel({
  sessionId, childId, childName, coachId, sessionStartTime,
  quickStrengths, quickStruggles,
}: MicroNotePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<'strength' | 'struggle' | 'word' | null>(null);
  const [recentNotes, setRecentNotes] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const minutesIn = Math.floor(
    (Date.now() - sessionStartTime.getTime()) / (1000 * 60)
  );

  const saveMicroObs = useCallback(async (data: Record<string, any>) => {
    try {
      await fetch('/api/intelligence/micro-observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, childId, coachId,
          minutesIntoSession: minutesIn,
          ...data,
        }),
      });
      const label = data.wordText || data.noteText?.substring(0, 30) ||
        (data.observationType === 'strength' ? 'Strength noted' : 'Struggle noted');
      setRecentNotes(prev => [label, ...prev].slice(0, 3));
      setActiveMode(null);
      setWordInput('');
    } catch (err) {
      console.error('[MicroNote] Save failed:', err);
    }
  }, [sessionId, childId, coachId, minutesIn]);

  const handleQuickObs = (type: 'strength' | 'struggle', obsId: string, text: string) => {
    saveMicroObs({ observationType: type, observationId: obsId });
    setRecentNotes(prev => [text.substring(0, 30), ...prev].slice(0, 3));
    setActiveMode(null);
  };

  const handleWordSave = () => {
    if (!wordInput.trim()) return;
    const isStruggled = wordInput.startsWith('-');
    const cleanWord = wordInput.replace(/^[+-]\s*/, '').trim();
    saveMicroObs({
      observationType: 'word',
      wordText: cleanWord,
      wordStatus: isStruggled ? 'struggled' : 'mastered',
    });
  };

  const handleVoiceNote = () => {
    const win = window as any;
    const SpeechRecognitionCtor = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      saveMicroObs({ observationType: 'note', noteText: text });
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // Collapsed: 3 small FABs
  if (!isExpanded) {
    return (
      <div className="fixed bottom-20 right-3 z-40 flex flex-col items-end gap-1.5 lg:bottom-4 lg:right-4">
        {recentNotes.length > 0 && (
          <span className="text-[10px] text-white/60 bg-black/60 px-2 py-0.5 rounded-full max-w-[160px] truncate">
            {recentNotes[0]}
          </span>
        )}
        <div className="flex gap-1.5">
          <button onClick={() => { setActiveMode('strength'); setIsExpanded(true); }}
            className="bg-green-600 p-2.5 rounded-full shadow-lg active:scale-95 transition-transform">
            <Star className="w-4 h-4 text-white" />
          </button>
          <button onClick={() => { setActiveMode('struggle'); setIsExpanded(true); }}
            className="bg-amber-600 p-2.5 rounded-full shadow-lg active:scale-95 transition-transform">
            <AlertTriangle className="w-4 h-4 text-white" />
          </button>
          <button onClick={() => { setActiveMode('word'); setIsExpanded(true); }}
            className="bg-blue-600 p-2.5 rounded-full shadow-lg active:scale-95 transition-transform">
            <Type className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded: quick picker
  return (
    <div className="fixed bottom-20 right-3 z-40 bg-gray-900 rounded-2xl shadow-2xl w-72 max-h-80 overflow-hidden lg:bottom-4 lg:right-4">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white/80 text-xs font-medium">
          {childName} · {minutesIn}min
        </span>
        <button onClick={() => { setIsExpanded(false); setActiveMode(null); }}>
          <X className="w-4 h-4 text-white/40" />
        </button>
      </div>

      <div className="p-2 max-h-60 overflow-y-auto">
        {activeMode === 'strength' && (
          <div className="space-y-1">
            <p className="text-[10px] text-green-400 uppercase tracking-wide px-1">Quick strength</p>
            {quickStrengths.length > 0 ? quickStrengths.map(obs => (
              <button key={obs.id}
                onClick={() => handleQuickObs('strength', obs.id, obs.text)}
                className="block w-full text-left text-xs text-white/80 bg-green-900/30 px-2.5 py-2 rounded-xl hover:bg-green-900/50 leading-snug">
                {obs.text}
              </button>
            )) : (
              <p className="text-[10px] text-white/30 px-1">No observations loaded</p>
            )}
          </div>
        )}

        {activeMode === 'struggle' && (
          <div className="space-y-1">
            <p className="text-[10px] text-amber-400 uppercase tracking-wide px-1">Quick struggle</p>
            {quickStruggles.length > 0 ? quickStruggles.map(obs => (
              <button key={obs.id}
                onClick={() => handleQuickObs('struggle', obs.id, obs.text)}
                className="block w-full text-left text-xs text-white/80 bg-amber-900/30 px-2.5 py-2 rounded-xl hover:bg-amber-900/50 leading-snug">
                {obs.text}
              </button>
            )) : (
              <p className="text-[10px] text-white/30 px-1">No observations loaded</p>
            )}
          </div>
        )}

        {activeMode === 'word' && (
          <div className="space-y-2">
            <p className="text-[10px] text-blue-400 uppercase tracking-wide px-1">
              Type word (prefix with - for struggled)
            </p>
            <div className="flex gap-1">
              <input
                type="text"
                value={wordInput}
                onChange={e => setWordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWordSave()}
                placeholder="cat, -pen, bat..."
                className="flex-1 bg-white/10 text-white text-xs px-2.5 py-2 rounded-xl border border-white/10 focus:border-blue-500 outline-none"
                autoFocus
              />
              <button onClick={handleWordSave}
                className="bg-blue-600 px-3 py-2 rounded-xl text-white text-xs font-medium">
                Add
              </button>
            </div>
            <button onClick={handleVoiceNote}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-xl w-full ${
                isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-white/60'
              }`}>
              <Mic className="w-3.5 h-3.5" />
              {isRecording ? 'Listening...' : 'Voice note'}
            </button>
          </div>
        )}

        {/* Recent notes */}
        {recentNotes.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-[10px] text-white/30 px-1 mb-1">Recent</p>
            {recentNotes.map((note, i) => (
              <p key={i} className="text-[10px] text-white/40 px-1 truncate">{note}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
