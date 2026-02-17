'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import CoachLayout from '@/components/layouts/CoachLayout';
import { supabase } from '@/lib/supabase/client';
import {
  Send,
  Loader2,
  User,
  Search,
  Users,
  X,
  ChevronLeft,
} from 'lucide-react';

interface Student {
  id: string;
  child_name: string;
  age: number;
  latest_assessment_score: number | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistantPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email!)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);

      // Get students through ENROLLMENTS (single source of truth)
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          child:children (
            id,
            child_name,
            age,
            latest_assessment_score
          )
        `)
        .eq('coach_id', coachData.id)
        .in('status', ['active', 'pending_start'])
        .order('created_at', { ascending: false });

      // Extract unique children from enrollments
      const studentsData = (enrollmentsData || [])
        .map(e => e.child)
        .filter(Boolean);

      setStudents(studentsData as any[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student | null) => {
    setSelectedStudent(student);
    setSidebarOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          childId: selectedStudent?.id || null,
          userRole: 'coach',
          userEmail: coach.email,
          chatHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = selectedStudent
    ? [
        `How is ${selectedStudent.child_name} progressing?`,
        `What should I focus on in ${selectedStudent.child_name}'s next session?`,
        `Prepare parent update for ${selectedStudent.child_name}`,
        `What are ${selectedStudent.child_name}'s strengths and weaknesses?`,
      ]
    : [
        'How are my students doing overall?',
        'What teaching strategies work best for struggling readers?',
        'How can I improve engagement in sessions?',
        'Tips for communicating progress to parents',
      ];

  const filteredStudents = students.filter((s) =>
    s.child_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
        </div>
      </CoachLayout>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout noPadding>
      <div className="h-[calc(100vh-120px)] flex gap-4 lg:gap-6 relative px-4 py-4">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Student Selection Sidebar */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-0
          w-72 bg-surface-1/50 rounded-none lg:rounded-2xl border-r lg:border border-border
          flex flex-col overflow-hidden
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:transform-none
        `}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00ABFF]" />
              Select Student
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-text-tertiary hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl py-2.5 pl-9 pr-3 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* General Chat Option */}
          <button
            onClick={() => handleStudentSelect(null)}
            className={`w-full p-3 text-left hover:bg-surface-2/50 transition-colors border-b border-border/50 ${
              !selectedStudent ? 'bg-[#FF0099]/10 border-l-2 border-l-[#FF0099]' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF0099]/20 rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src="/images/rai-mascot.png"
                  alt="rAI"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-medium text-white">General Assistant</p>
                <p className="text-text-tertiary text-sm">Ask anything</p>
              </div>
            </div>
          </button>

          {/* Students List */}
          {filteredStudents.map((student) => (
            <button
              key={student.id}
              onClick={() => handleStudentSelect(student)}
              className={`w-full p-3 text-left hover:bg-surface-2/50 transition-colors ${
                selectedStudent?.id === student.id ? 'bg-[#FF0099]/10 border-l-2 border-l-[#FF0099]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center text-white font-bold">
                  {student.child_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-white">{student.child_name}</p>
                  <p className="text-gray-400 text-sm">
                    Age {student.age} • Score: {student.latest_assessment_score ?? '-'}/10
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-surface-1/50 rounded-2xl border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {/* Mobile: Student selector button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center gap-2 bg-surface-2 px-3 py-2 rounded-xl text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm">
                {selectedStudent ? selectedStudent.child_name : 'Select'}
              </span>
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="hidden lg:flex w-11 h-11 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl items-center justify-center overflow-hidden">
              <Image
                src="/images/rai-mascot.png"
                alt="rAI"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div className="hidden lg:block">
              <h1 className="font-semibold text-white text-lg">rAI Assistant</h1>
              <p className="text-text-tertiary text-sm">
                {selectedStudent
                  ? `Asking about ${selectedStudent.child_name}`
                  : 'General coaching assistant'}
              </p>
            </div>

            {/* Mobile title */}
            <div className="lg:hidden flex-1">
              <h1 className="font-semibold text-white">rAI Assistant</h1>
            </div>

            <span className="ml-auto text-xs bg-[#FF0099]/20 text-[#FF0099] px-3 py-1.5 rounded-full hidden sm:block font-medium">
              RAG Powered
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 bg-[#FF0099]/20 rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
                <Image
                  src="/images/rai-mascot.png"
                  alt="rAI"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">
                {selectedStudent
                  ? `Ask me about ${selectedStudent.child_name}`
                  : 'How can I help you today?'}
              </h3>
              <p className="text-text-tertiary text-sm max-w-md mb-6">
                {selectedStudent
                  ? `I have access to ${selectedStudent.child_name}'s assessments, session notes, and progress data.`
                  : 'Select a student for personalized insights, or ask general coaching questions.'}
              </p>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-xs sm:text-sm bg-surface-2/50 text-text-secondary px-3 sm:px-4 py-2 rounded-full hover:bg-surface-2 border border-border hover:border-[#FF0099]/50 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white'
                      : 'bg-surface-2/50 text-text-secondary border border-border'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-surface-2 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-xl flex items-center justify-center overflow-hidden">
                <Image
                  src="/images/rai-mascot.png"
                  alt="rAI"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="bg-surface-2/50 rounded-2xl px-4 py-3 border border-border">
                <Loader2 className="w-5 h-5 animate-spin text-[#FF0099]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-border">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && sendMessage()}
              placeholder={
                selectedStudent
                  ? `Ask about ${selectedStudent.child_name}...`
                  : 'Ask me anything about coaching...'
              }
              className="flex-1 bg-surface-2 border border-border rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-white text-sm sm:text-base placeholder:text-text-tertiary focus:outline-none focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] hover:opacity-90 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      </div>
    </CoachLayout>
  );
}
