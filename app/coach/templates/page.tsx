'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  Loader2,
  Users,
  Search,
  ExternalLink,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Template {
  id: string;
  name: string;
  slug: string;
  category: string;
  template: string;
  variables: string[];
}

interface Student {
  id: string;
  child_name: string;
  parent_name: string;
  parent_phone: string;
  latest_assessment_score: number | null;
}

export default function WhatsAppTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTemplate && selectedStudent && coach) {
      generatePreview();
    }
  }, [selectedTemplate, selectedStudent, coach]);

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

      // Get templates
      const { data: templatesData } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('is_active', true)
        .order('category');

      setTemplates(templatesData || []);

      // Get students
      const { data: studentsData } = await supabase
        .from('children')
        .select('id, child_name, parent_name, parent_phone, latest_assessment_score')
        .eq('assigned_coach_id', coachData.id)
        .order('child_name');

      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = () => {
    if (!selectedTemplate || !selectedStudent || !coach) return;

    let message = selectedTemplate.template;

    // Replace variables
    const replacements: Record<string, string> = {
      '{parentName}': selectedStudent.parent_name || 'Parent',
      '{childName}': selectedStudent.child_name,
      '{coachName}': coach.name,
      '{coachId}': coach.id,
      '{score}': selectedStudent.latest_assessment_score?.toString() || 'N/A',
      '{category}': getScoreCategory(selectedStudent.latest_assessment_score),
      '{date}': new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }),
      '{time}': '4:00 PM',
      '{meetLink}': 'https://meet.google.com/xxx-xxxx-xxx',
      '{sessionNum}': '1',
      '{highlights}': 'Great progress on pronunciation!',
      '{daysSince}': '7',
    };

    Object.entries(replacements).forEach(([key, value]) => {
      message = message.replace(new RegExp(key, 'g'), value);
    });

    setPreviewMessage(message);
  };

  const getScoreCategory = (score: number | null) => {
    if (score === null) return 'Not assessed';
    if (score >= 8) return 'Reading Wizard';
    if (score >= 5) return 'Reading Star';
    return 'Budding Reader';
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(previewMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendWhatsApp = () => {
    if (!selectedStudent || !previewMessage) return;
    const phone = selectedStudent.parent_phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(previewMessage)}`;
    window.open(url, '_blank');
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'lead_generation':
        return 'bg-purple-500/20 text-purple-400';
      case 'session':
        return 'bg-blue-500/20 text-blue-400';
      case 'retention':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'lead_generation':
        return 'Lead Gen';
      case 'session':
        return 'Session';
      case 'retention':
        return 'Retention';
      default:
        return category;
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.child_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.parent_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-green-400" />
            WhatsApp Templates
          </h1>
          <p className="text-gray-400">Send pre-built messages to parents with one click</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Select Template</h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-[500px] overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                    selectedTemplate?.id === template.id ? 'bg-gray-700/50 border-l-2 border-pink-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{template.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                      {getCategoryLabel(template.category)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">{template.template}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white mb-3">Select Student</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 pl-9 pr-4 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-700 max-h-[420px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No students found
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                      selectedStudent?.id === student.id ? 'bg-gray-700/50 border-l-2 border-pink-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {student.child_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{student.child_name}</p>
                        <p className="text-gray-400 text-sm">{student.parent_name}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Preview & Send */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="font-semibold text-white">Preview & Send</h2>
            </div>
            <div className="p-4">
              {!selectedTemplate || !selectedStudent ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template and student to preview the message</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Info */}
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Sending to</p>
                    <p className="text-white font-medium">{selectedStudent.parent_name}</p>
                    <p className="text-gray-400 text-sm">{selectedStudent.parent_phone}</p>
                  </div>

                  {/* Message Preview */}
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                    <p className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
                      {previewMessage}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={copyToClipboard}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-white py-3 rounded-xl font-medium hover:bg-gray-600 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-5 h-5 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={sendWhatsApp}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 transition-colors"
                    >
                      <Send className="w-5 h-5" />
                      Send WhatsApp
                    </button>
                  </div>

                  <p className="text-gray-500 text-xs text-center">
                    Opens WhatsApp with pre-filled message
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  );
}
