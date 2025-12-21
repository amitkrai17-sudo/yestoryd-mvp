'use client';

import { useState } from 'react';
import { 
  HelpCircle, 
  Send, 
  Loader2, 
  CheckCircle, 
  X,
  MessageSquare,
  CreditCard,
  Wrench,
  UserCheck,
  Calendar,
  BookOpen,
  MoreHorizontal,
  Sparkles
} from 'lucide-react';

interface SupportFormProps {
  userType: 'parent' | 'coach';
  userEmail: string;
  userName: string;
  childName?: string;
  coachName?: string;
  onClose?: () => void;
  isModal?: boolean;
}

const CATEGORIES = [
  { id: 'session_issue', label: 'Session Issue', icon: MessageSquare, description: 'Problem with a coaching session' },
  { id: 'payment_billing', label: 'Payment / Billing', icon: CreditCard, description: 'Payment, refund, or billing questions' },
  { id: 'technical_problem', label: 'Technical Problem', icon: Wrench, description: 'App or website not working' },
  { id: 'coach_feedback', label: 'Coach Feedback', icon: UserCheck, description: 'Feedback about your coach' },
  { id: 'schedule_change', label: 'Schedule Change', icon: Calendar, description: 'Reschedule or cancel sessions' },
  { id: 'program_question', label: 'Program Question', icon: BookOpen, description: 'Questions about the program' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, description: 'Something else' },
];

export default function SupportForm({
  userType,
  userEmail,
  userName,
  childName,
  coachName,
  onClose,
  isModal = false,
}: SupportFormProps) {
  const [step, setStep] = useState<'category' | 'details' | 'success'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [error, setError] = useState('');

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Please describe your issue');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType,
          userEmail,
          userName,
          childName,
          coachName,
          category: selectedCategory,
          subject: subject.trim() || undefined,
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit ticket');
      }

      setTicketNumber(data.ticket.ticketNumber);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('category');
    setSelectedCategory('');
    setSubject('');
    setDescription('');
    setError('');
    setTicketNumber('');
  };

  const categoryInfo = CATEGORIES.find(c => c.id === selectedCategory);

  // Theme colors based on user type
  const theme = userType === 'parent' 
    ? { primary: '#7b008b', gradient: 'from-[#7b008b] to-[#ff0099]' }
    : { primary: '#00abff', gradient: 'from-[#00abff] to-[#0066cc]' };

  const containerClass = isModal 
    ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'
    : '';

  const formClass = isModal
    ? 'bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden'
    : 'bg-white rounded-2xl border border-gray-200 overflow-hidden';

  return (
    <div className={containerClass}>
      <div className={formClass}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.gradient} px-6 py-4 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold">Need Help?</h2>
                <p className="text-sm text-white/80">
                  {step === 'category' && 'Select a category'}
                  {step === 'details' && categoryInfo?.label}
                  {step === 'success' && 'Request Submitted'}
                </p>
              </div>
            </div>
            {(isModal || onClose) && (
              <button
                onClick={onClose || handleReset}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                What can we help you with today?
              </p>
              
              {/* Ask rAI first suggestion */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#7b008b] to-[#ff0099] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Try asking rAI first!</p>
                    <p className="text-xs text-gray-600 mt-1">
                      rAI can instantly answer questions about sessions, progress, schedules, and more.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left group"
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                      style={{ backgroundColor: `${theme.primary}15` }}
                    >
                      <category.icon className="w-5 h-5" style={{ color: theme.primary }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{category.label}</p>
                      <p className="text-xs text-gray-500">{category.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Details Form */}
          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('category')}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                ← Change category
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe your issue <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide as much detail as possible so we can help you quickly..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all resize-none"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('category')}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className={`flex-1 px-4 py-2.5 bg-gradient-to-r ${theme.gradient} text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">Request Submitted!</h3>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Your ticket number</p>
                <p className="text-2xl font-bold" style={{ color: theme.primary }}>
                  {ticketNumber}
                </p>
              </div>
              
              <p className="text-gray-600 text-sm mb-6">
                We've sent a confirmation to <strong>{userEmail}</strong>.<br />
                Our team will respond within 24 hours.
              </p>

              <div className="space-y-3">
                <button
                  onClick={onClose || handleReset}
                  className={`w-full px-4 py-2.5 bg-gradient-to-r ${theme.gradient} text-white rounded-xl hover:shadow-lg transition-all font-medium`}
                >
                  Done
                </button>
                
                <p className="text-xs text-gray-500">
                  Need urgent help? Call us at{' '}
                  <a href="tel:+918976287997" className="font-medium" style={{ color: theme.primary }}>
                    +91 8976287997
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}