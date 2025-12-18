// app/yestoryd-academy/assessment/page.tsx
// Vedant AI Assessment - Fully Gemini-driven conversation

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Send,
  Loader2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

export default function VedantAIAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start conversation immediately when page loads
  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = async () => {
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
        setMessages([{
          role: 'assistant',
          content: data.message
        }]);
        setQuestionNumber(data.questionNumber || 1);
        if (data.isComplete) setIsComplete(true);
      } else {
        // Fallback greeting
        setMessages([{
          role: 'assistant',
          content: `Namaste! I'm Vedant, and I'll be chatting with you today to learn about your approach to teaching children. 🙏

Let's dive right in with a scenario:

**Question 1 of 5:**
A 6-year-old has been struggling with the same word for 3 sessions. They're getting frustrated and saying "I can't do this." How would you handle this situation?`
        }]);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      // Fallback
      setMessages([{
        role: 'assistant',
        content: `Namaste! I'm Vedant, and I'll be chatting with you today to learn about your approach to teaching children. 🙏

Let's dive right in with a scenario:

**Question 1 of 5:**
A 6-year-old has been struggling with the same word for 3 sessions. They're getting frustrated and saying "I can't do this." How would you handle this situation?`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isTyping || isComplete) return;
    
    const userMessage = currentInput.trim();
    setCurrentInput('');
    
    // Add user message to chat
    const updatedMessages: Message[] = [...messages, {
      role: 'user',
      content: userMessage
    }];
    setMessages(updatedMessages);
    
    // Get AI response
    setIsTyping(true);
    
    try {
      const response = await fetch('/api/coach-assessment/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          questionNumber
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message
        }]);
        
        if (data.questionNumber) {
          setQuestionNumber(data.questionNumber);
        }
        
        if (data.isComplete) {
          setIsComplete(true);
        }
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I appreciate you sharing that. Could you tell me a bit more about your thinking here?"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSubmitAssessment = async () => {
    if (!applicationId) {
      alert('Application ID not found. Please start the application again.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Store the entire conversation
      const { data: applicationData, error } = await (supabase
        .from('coach_applications') as any)
        .update({
          ai_responses: messages,
          ai_assessment_completed_at: new Date().toISOString(),
          status: 'ai_assessment_complete'
        })
        .eq('id', applicationId)
        .select('name, email, phone, city')
        .single();
      
      if (error) throw error;
      
      // Send confirmation emails
      try {
        await fetch('/api/coach-application/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicantEmail: applicationData?.email,
            applicantName: applicationData?.name,
            applicantPhone: applicationData?.phone,
            city: applicationData?.city,
            applicationId: applicationId
          })
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        // Don't block submission if email fails
      }
      
      router.push('/yestoryd-academy/confirmation');
      
    } catch (error) {
      console.error('Error submitting assessment:', error);
      alert('There was an error saving your assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate progress (rough estimate based on question number)
  const progress = isComplete ? 100 : Math.min((questionNumber / 5) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">Vedant AI</h1>
              <p className="text-xs text-slate-400">Coach Assessment</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-slate-400">Progress</div>
            <div className="text-lg font-bold text-white">
              {isComplete ? '✓' : `${questionNumber}/5`}
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'bg-slate-700/50 text-slate-100 border border-slate-600'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-medium text-pink-400">Vedant</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-700/50 rounded-2xl px-4 py-3 border border-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area or Complete Button */}
      <div className="border-t border-slate-700 bg-slate-900/80 backdrop-blur-md p-4">
        <div className="max-w-2xl mx-auto">
          {isComplete ? (
            <button
              onClick={handleSubmitAssessment}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving your responses...
                </>
              ) : (
                <>
                  Complete Assessment
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your response..."
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-0 outline-none resize-none text-sm"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!currentInput.trim() || isTyping}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-3 rounded-xl disabled:opacity-50 hover:shadow-lg transition-all self-end"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {!isComplete && (
            <p className="text-center text-xs text-slate-500 mt-3">
              Press Enter to send • Be thoughtful, there's no rush
            </p>
          )}
        </div>
      </div>
    </div>
  );
}