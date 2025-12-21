'use client';

import { useState } from 'react';
import { HelpCircle, MessageSquare, Sparkles, ChevronRight } from 'lucide-react';
import SupportForm from './SupportForm';

interface SupportWidgetProps {
  userType: 'parent' | 'coach';
  userEmail: string;
  userName: string;
  childName?: string;
  coachName?: string;
  variant?: 'card' | 'minimal' | 'inline';
}

export default function SupportWidget({
  userType,
  userEmail,
  userName,
  childName,
  coachName,
  variant = 'card',
}: SupportWidgetProps) {
  const [showForm, setShowForm] = useState(false);

  const theme = userType === 'parent'
    ? { primary: '#7b008b', gradient: 'from-[#7b008b] to-[#ff0099]', bg: 'bg-purple-50', border: 'border-purple-100' }
    : { primary: '#00abff', gradient: 'from-[#00abff] to-[#0066cc]', bg: 'bg-blue-50', border: 'border-blue-100' };

  // Card variant - full support card with rAI suggestion
  if (variant === 'card') {
    return (
      <>
        <div className={`${theme.bg} ${theme.border} border rounded-2xl p-6`}>
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${theme.primary}20` }}
            >
              <HelpCircle className="w-6 h-6" style={{ color: theme.primary }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Have a question or facing an issue? We're here to help!
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Ask rAI Button */}
                <button
                  onClick={() => {
                    // Try to find and click the rAI chat widget button
                    const chatButton = document.querySelector('[aria-label*="rAI"]') as HTMLButtonElement;
                    if (chatButton) chatButton.click();
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7b008b] to-[#ff0099] text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Ask rAI First
                </button>
                
                {/* Submit Request Button */}
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:border-gray-400 transition-all text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Support Form Modal */}
        {showForm && (
          <SupportForm
            userType={userType}
            userEmail={userEmail}
            userName={userName}
            childName={childName}
            coachName={coachName}
            onClose={() => setShowForm(false)}
            isModal={true}
          />
        )}
      </>
    );
  }

  // Minimal variant - just a button
  if (variant === 'minimal') {
    return (
      <>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Need Help?
        </button>

        {showForm && (
          <SupportForm
            userType={userType}
            userEmail={userEmail}
            userName={userName}
            childName={childName}
            coachName={coachName}
            onClose={() => setShowForm(false)}
            isModal={true}
          />
        )}
      </>
    );
  }

  // Inline variant - compact row style
  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group"
      >
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${theme.primary}15` }}
        >
          <HelpCircle className="w-5 h-5" style={{ color: theme.primary }} />
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-gray-900">Need Help?</p>
          <p className="text-xs text-gray-500">Submit a support request</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </button>

      {showForm && (
        <SupportForm
          userType={userType}
          userEmail={userEmail}
          userName={userName}
          childName={childName}
          coachName={coachName}
          onClose={() => setShowForm(false)}
          isModal={true}
        />
      )}
    </>
  );
}
