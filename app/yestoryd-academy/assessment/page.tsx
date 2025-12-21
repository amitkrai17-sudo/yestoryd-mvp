// app/yestoryd-academy/assessment/page.tsx
// Step 3 of 3: Voice Recording (required) + Gemini-powered rAI AI Chat (4 questions)
// UPDATED: Includes email sending, score calculation, full conversation storage

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Send,
  Sparkles,
  User
} from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

function AssessmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceComplete, setVoiceComplete] = useState(false);

  // rAI States
  const [showRaiChat, setshowRaiChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [chatComplete, setChatComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load application
  useEffect(() => {
    const loadApplication = async () => {
      if (!applicationId) {
        router.push('/yestoryd-academy/apply');
        return;
      }

      const { data, error: fetchError } = await (supabase
        .from('coach_applications') as any)
        .select('*')
        .eq('id', applicationId!)
        .single();

      if (fetchError || !data) {
        setError('Application not found. Please start over.');
      } else {
        setApplicationData(data);
      }
      setIsLoading(false);
    };

    loadApplication();
  }, [applicationId, router]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) { // 2 minutes max
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please allow microphone permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const confirmVoice = async () => {
    if (!audioBlob || !applicationId) return;

    // Upload audio to storage
    try {
      const fileName = `${applicationId}-voice-statement.webm`;
      const filePath = `audio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('coach-applications')
        .upload(filePath, audioBlob, { upsert: true });

      if (uploadError) {
        console.error('Audio upload error:', uploadError);
      } else {
        // Update application with audio URL
        const { data: urlData } = supabase.storage
          .from('coach-applications')
          .getPublicUrl(filePath);

        await (supabase
          .from('coach_applications') as any)
          .update({
            audio_statement_url: urlData.publicUrl,
            audio_duration_seconds: recordingTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId!);
      }
    } catch (err) {
      console.error('Error saving audio:', err);
    }

    setVoiceComplete(true);
    setshowRaiChat(true);

    // Start rAI conversation
    setTimeout(() => {
      startRaiConversation();
    }, 500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // rAI - Gemini powered conversation
  const startRaiConversation = async () => {
    setIsTyping(true);

    try {
      const response = await fetch('/api/coach-assessment/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [],
          questionNumber: 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([{ role: 'assistant', content: data.message }]);
        setQuestionNumber(data.questionNumber || 1);
      } else {
        // Fallback greeting
        setMessages([{
          role: 'assistant',
          content: "Namaste! 🙏 I'm rAI, and I'll be having a brief chat with you today. I'd love to understand how you approach working with children.\n\nQuestion 1 of 4: Imagine you're coaching a 6-year-old who suddenly gets frustrated and says 'I can't do this.' How would you handle that moment?"
        }]);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      setMessages([{
        role: 'assistant',
        content: "Namaste! 🙏 I'm rAI, and I'll be having a brief chat with you today. I'd love to understand how you approach working with children.\n\nQuestion 1 of 4: Imagine you're coaching a 6-year-old who suddenly gets frustrated and says 'I can't do this.' How would you handle that moment?"
      }]);
    }

    setIsTyping(false);
    inputRef.current?.focus();
  };

  const handleSendResponse = async () => {
    if (!currentInput.trim() || isTyping) return;

    const userMessage = currentInput.trim();
    setCurrentInput('');
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await fetch('/api/coach-assessment/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          questionNumber
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setQuestionNumber(data.questionNumber || questionNumber + 1);
        
        if (data.isComplete) {
          setChatComplete(true);
          // Save assessment data with FULL conversation
          await saveAssessment([...newMessages, { role: 'assistant', content: data.message }], data);
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.error('Error in conversation:', err);
      // Fallback response
      const fallbackResponses = [
        "That's a thoughtful approach. Here's another scenario: After a month of coaching, a parent tells you their child hasn't improved much. They're disappointed. What would you say?",
        "I appreciate your perspective. Next: During a session, a usually cheerful child seems quiet and withdrawn today. How would you approach this?",
        "Thank you for sharing. Last question: A parent asks 'Can you guarantee my child will improve by 2 grade levels in 3 months?' How do you respond?",
        "Thank you for sharing your thoughts! 🙏\n\nOur team will review your application within 48 hours. If we're a good match, you'll hear from Rucha (our founder).\n\nBest wishes!"
      ];
      
      const nextQ = Math.min(questionNumber, 4);
      const fallbackMessage = fallbackResponses[nextQ - 1] || fallbackResponses[3];
      
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackMessage }]);
      
      if (questionNumber >= 4) {
        setChatComplete(true);
        await saveAssessment([...newMessages, { role: 'assistant', content: fallbackMessage }], { questionNumber: 4, isComplete: true });
      } else {
        setQuestionNumber(nextQ + 1);
      }
    }

    setIsTyping(false);
    inputRef.current?.focus();
  };

  // UPDATED: Save FULL conversation (not just user responses)
  const saveAssessment = async (allMessages: Message[], data: any) => {
    if (!applicationId) return;

    try {
      const { error: updateError } = await (supabase
        .from('coach_applications') as any)
        .update({
          ai_responses: allMessages, // Store FULL conversation
          ai_assessment_completed_at: new Date().toISOString(),
          status: 'ai_assessment_complete',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId!);

      if (updateError) {
        console.error('Error saving assessment:', updateError);
      }
    } catch (err) {
      console.error('Error saving assessment:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendResponse();
    }
  };

  // UPDATED: Complete handler with email + score calculation
  const handleComplete = async () => {
    setIsSubmitting(true);

    try {
      // 1. Get application data for email
      const { data: appData } = await (supabase
        .from('coach_applications') as any)
        .select('name, email, phone, city')
        .eq('id', applicationId!)
        .single();

      // 2. Calculate score (don't wait, fire and forget)
      fetch('/api/coach-assessment/calculate-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId })
      }).catch(err => console.error('Score calculation error:', err));

      // 3. Send confirmation email
      try {
        await fetch('/api/coach-application/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicantEmail: appData?.email,
            applicantName: appData?.name,
            applicantPhone: appData?.phone,
            city: appData?.city,
            applicationId: applicationId
          })
        });
      } catch (emailErr) {
        console.error('Email error:', emailErr);
        // Don't block if email fails
      }

      // 4. Navigate to confirmation
      router.push(`/yestoryd-academy/confirmation?applicationId=${applicationId}`);

    } catch (err) {
      console.error('Error completing:', err);
      // Navigate anyway
      router.push(`/yestoryd-academy/confirmation?applicationId=${applicationId}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    );
  }

  // Error state
  if (error && !applicationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/yestoryd-academy/apply"
            className="inline-flex items-center gap-2 bg-[#ff0099] text-white px-6 py-3 rounded-xl font-semibold"
          >
            Start Over
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/yestoryd-academy">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={35}
              className="h-8 w-auto"
            />
          </Link>
          <span className="text-sm text-slate-500">Step 3 of 3</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className={`h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] transition-all duration-500 ${
            chatComplete ? 'w-full' : voiceComplete ? 'w-[85%]' : 'w-[70%]'
          }`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-2xl mx-auto w-full px-4 py-8">
        {/* Part 1: Voice Recording */}
        {!showRaiChat && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                <Mic className="w-4 h-4" />
                Part 1: Voice Introduction
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                Tell Us Your Story
              </h1>
              <p className="text-slate-600">
                Record a 1-2 minute voice statement about why you want to become a reading coach
              </p>
            </div>

            {/* Recording Interface */}
            <div className="text-center py-8">
              {!audioBlob ? (
                <>
                  {/* Recording in progress */}
                  {isRecording ? (
                    <>
                      <div className="w-24 h-24 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <Mic className="w-10 h-10 text-white" />
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mb-2">
                        {formatTime(recordingTime)}
                      </p>
                      <p className="text-slate-600 mb-6">Recording...</p>
                      <button
                        onClick={stopRecording}
                        className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
                      >
                        <Square className="w-5 h-5" />
                        Stop Recording
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-600 mb-6">Click to start recording</p>
                      <button
                        onClick={startRecording}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        <Mic className="w-5 h-5" />
                        Start Recording
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Recording complete - playback */}
                  <div className="w-24 h-24 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>

                  <p className="text-xl font-bold text-slate-900 mb-2">
                    Recording Complete!
                  </p>
                  <p className="text-slate-600 mb-6">Duration: {formatTime(recordingTime)}</p>

                  {/* Audio player */}
                  <audio
                    ref={audioRef}
                    src={audioUrl || undefined}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />

                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      onClick={playAudio}
                      className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      onClick={resetRecording}
                      className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Record Again
                    </button>
                  </div>

                  <button
                    onClick={confirmVoice}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-10 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                  >
                    Continue to rAI
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-600">
                <strong>Tips:</strong> Share a moment when you made a difference in a child's learning. 
                Speak naturally — we want to hear the real you!
              </p>
            </div>

            {/* Back link */}
            <div className="mt-6">
              <Link
                href={`/yestoryd-academy/qualify?applicationId=${applicationId}`}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </div>
          </div>
        )}

        {/* Part 2: rAI Chat - Gemini Powered */}
        {showRaiChat && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-180px)] md:h-[600px]">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">rAI</h2>
                <p className="text-xs text-slate-500">
                  {chatComplete ? 'Assessment Complete ✓' : `Question ${Math.min(questionNumber, 4)} of 4`}
                </p>
              </div>
              {/* Voice recording badge */}
              {voiceComplete && (
                <div className="ml-auto flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  Voice ✓
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'assistant'
                      ? 'bg-gradient-to-r from-[#ff0099] to-[#7b008b]'
                      : 'bg-slate-200'
                  }`}>
                    {message.role === 'assistant' ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'assistant'
                      ? 'bg-slate-100 text-slate-900'
                      : 'bg-[#ff0099] text-white'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200">
              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {!chatComplete ? (
                <div className="flex items-end gap-3">
                  <textarea
                    ref={inputRef}
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    className="flex-grow resize-none rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff0099] focus:border-transparent min-h-[50px] max-h-[120px] text-slate-900 bg-white"
                    rows={2}
                    disabled={isTyping}
                  />
                  <button
                    onClick={handleSendResponse}
                    disabled={!currentInput.trim() || isTyping}
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      currentInput.trim() && !isTyping
                        ? 'bg-[#ff0099] text-white hover:bg-[#e6008a]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-6 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Complete Application
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff0099]" />
      </div>
    }>
      <AssessmentPageContent />
    </Suspense>
  );
}
