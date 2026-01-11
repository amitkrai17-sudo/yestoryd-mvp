'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  User,
  Search,
  Users,
  X,
  ChevronLeft,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
        .eq('email', user.email)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);

      // Get students
      const { data: studentsData } = await supabase
        .from('children')
        .select('id, child_name, age, latest_assessment_score')
        .eq('coach_id', coachData.id)
        .order('child_name');

      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student | null) => {
    setSelectedStudent(student);
    setSidebarOpen(false); // Close sidebar on mobile after selection
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
      // Get student data if selected
      let studentData = null;
      if (selectedStudent) {
        const { data: assessments } = await supabase
          .from('assessments')
          .select('*')
          .eq('child_id', selectedStudent.id)
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: sessionNotes } = await supabase
          .from('session_notes')
          .select('*')
          .eq('child_id', selectedStudent.id)
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: sessions } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .eq('child_id', selectedStudent.id)
          .order('scheduled_date', { ascending: false });

        studentData = {
          assessments,
          sessionNotes,
          sessions,
        };
      }

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout coach={coach}>
      <div className="h-[calc(100vh-120px)] flex gap-4 lg:gap-6 relative">
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
            w-72 bg-gray-800 rounded-none lg:rounded-xl border-r lg:border border-gray-700 
            flex flex-col overflow-hidden
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:transform-none
          `}
        >
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Select Student
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 pl-9 pr-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* General Chat Option */}
            <button
              onClick={() => handleStudentSelect(null)}
              className={`w-full p-3 text-left hover:bg-gray-700/50 transition-colors border-b border-gray-700 ${
                !selectedStudent ? 'bg-gray-700/50 border-l-2 border-pink-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white">General Assistant</p>
                  <p className="text-gray-400 text-sm">Ask anything</p>
                </div>
              </div>
            </button>

            {/* Students List */}
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => handleStudentSelect(student)}
                className={`w-full p-3 text-left hover:bg-gray-700/50 transition-colors ${
                  selectedStudent?.id === student.id ? 'bg-gray-700/50 border-l-2 border-pink-500' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
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
        <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              {/* Mobile: Student selector button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-600 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm">
                  {selectedStudent ? selectedStudent.child_name : 'Select'}
                </span>
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="hidden lg:flex w-10 h-10 bg-purple-500 rounded-xl items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="hidden lg:block">
                <h1 className="font-semibold text-white">AI Assistant</h1>
                <p className="text-gray-400 text-sm">
                  {selectedStudent
                    ? `Asking about ${selectedStudent.child_name}`
                    : 'General coaching assistant'}
                </p>
              </div>

              {/* Mobile title */}
              <div className="lg:hidden flex-1">
                <h1 className="font-semibold text-white">AI Assistant</h1>
              </div>

              <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full hidden sm:block">
                RAG Powered
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 lg:w-16 lg:h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 lg:w-8 lg:h-8 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">
                  {selectedStudent
                    ? `Ask me about ${selectedStudent.child_name}`
                    : 'How can I help you today?'}
                </h3>
                <p className="text-gray-400 text-sm max-w-md mb-6">
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
                      className="text-xs sm:text-sm bg-gray-700 text-gray-300 px-3 sm:px-4 py-2 rounded-full hover:bg-gray-600 transition-colors"
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
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
                      message.role === 'user'
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-700 text-gray-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-700 rounded-2xl px-3 sm:px-4 py-2 sm:py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 sm:p-4 border-t border-gray-700">
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
                className="flex-1 bg-gray-700 border border-gray-600 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-white text-sm sm:text-base placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
