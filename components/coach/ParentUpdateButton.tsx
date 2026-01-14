'use client';

// components/coach/ParentUpdateButton.tsx
// Button component for one-click parent updates on session cards

import { useState } from 'react';
import { MessageCircle, Check, Loader2 } from 'lucide-react';
import { ChatWidget } from '@/components/chat/ChatWidget';

interface ParentUpdateButtonProps {
  session: {
    id: string;
    scheduled_time: string;
    status: string;
    parent_update_sent_at?: string | null;
    child: {
      id: string;
      child_name: string;
      parent_phone?: string;
      parent_name?: string;
    };
  };
  coachEmail: string;
}

export function ParentUpdateButton({ session, coachEmail }: ParentUpdateButtonProps) {
  const [showChat, setShowChat] = useState(false);
  const [updateSent, setUpdateSent] = useState(!!session.parent_update_sent_at);

  // Only show for completed sessions
  if (session.status !== 'completed') {
    return null;
  }

  // Format date for prompt
  const sessionDate = new Date(session.scheduled_time).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // Generate the prompt for rAI
  const prompt = `Summarize the recent reading progress for ${session.child.child_name} after their coaching on ${sessionDate}.

Create a warm parent update that includes:
- What skills and activities were practiced
- Progress and wins observed
- Any areas that need attention
- Home practice suggestions for this week

Keep it encouraging, under 200 words. Use a few emojis. Format for WhatsApp.`;

  const handleMessageSent = () => {
    setUpdateSent(true);
  };

  // Already sent
  if (updateSent) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <Check className="w-3.5 h-3.5" />
        <span>Update sent</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowChat(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-lg hover:shadow-md transition-all"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>Update Parent</span>
      </button>

      {showChat && (
        <div className="fixed inset-0 z-40" onClick={() => setShowChat(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" />
        </div>
      )}

      {showChat && (
        <ChatWidget
          childId={session.child.id}
          childName={session.child.child_name}
          userRole="coach"
          userEmail={coachEmail}
          initialPrompt={prompt}
          autoSend={true}
          
          sessionContext={{
            sessionId: session.id,
            parentPhone: session.child.parent_phone || '',
            parentName: session.child.parent_name || 'Parent',
            sessionDate: sessionDate,
          }}
        />
      )}
    </>
  );
}

export default ParentUpdateButton;



