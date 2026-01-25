'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ParentLayout, { useParentContext } from '@/components/parent/ParentLayout';
import SupportForm from '@/components/support/SupportForm';
import { HelpCircle, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Ticket {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  session_issue: 'Session Issue',
  technical_problem: 'Technical Problem',
  payment_billing: 'Payment & Billing',
  coach_feedback: 'Coach Feedback',
  general_question: 'General Question',
  other: 'Other',
};

export default function ParentSupportPage() {
  const { parentEmail, parentName, childName } = useParentContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (parentEmail) {
      fetchTickets();
    }
  }, [parentEmail]);

  async function fetchTickets() {
    try {
      const res = await fetch(`/api/support/tickets?email=${encodeURIComponent(parentEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
    setLoading(false);
  }

  function handleTicketCreated() {
    setShowForm(false);
    fetchTickets();
  }

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Support Center</h1>
          <p className="text-gray-500 mt-1">Get help with your questions and concerns</p>
        </div>

        {/* New Request Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 p-5 bg-gradient-to-r from-[#7b008b] to-[#ff0099] text-white rounded-2xl font-semibold hover:from-[#6a0078] hover:to-[#e6008a] transition-all shadow-lg flex items-center justify-center gap-3"
          >
            <HelpCircle className="w-6 h-6" />
            Submit New Request
          </button>
        )}

        {/* Support Form */}
        {showForm && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">New Support Request</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            <SupportForm
              userType="parent"
              userEmail={parentEmail}
              userName={parentName}
              childName={childName}
              onClose={handleTicketCreated}
              isModal={false}
            />
          </div>
        )}

        {/* Tickets List */}
        {!showForm && (
          <>
            {/* Active Tickets */}
            {openTickets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Active Requests ({openTickets.length})
                </h2>
                <div className="space-y-3">
                  {openTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Tickets */}
            {resolvedTickets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Resolved ({resolvedTickets.length})
                </h2>
                <div className="space-y-3">
                  {resolvedTickets.slice(0, 5).map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => setSelectedTicket(ticket)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && tickets.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <HelpCircle className="w-16 h-16 text-[#7b008b]/30 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No Support Requests</h2>
                <p className="text-gray-500 mb-6">You haven't submitted any requests yet.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all shadow-lg"
                >
                  Submit Your First Request
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading your requests...</p>
              </div>
            )}
          </>
        )}

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <TicketDetailModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </div>
    </ParentLayout>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const StatusIcon = statusConfig.icon;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-[#7b008b]/30 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="font-medium text-gray-800 truncate">
            {CATEGORY_LABELS[ticket.category] || ticket.category}
          </p>
          {ticket.subject && (
            <p className="text-sm text-gray-600 truncate mt-1">{ticket.subject}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {new Date(ticket.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}

// Ticket Detail Modal
function TicketDetailModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-sm font-mono text-gray-400">{ticket.ticket_number}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <span className="text-xl text-gray-500">×</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Category</p>
            <p className="font-medium text-gray-800">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
          </div>

          {ticket.subject && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Subject</p>
              <p className="text-gray-800">{ticket.subject}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted</p>
            <p className="text-gray-700">
              {new Date(ticket.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>

          {ticket.resolution_notes && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 uppercase tracking-wide mb-1">Resolution</p>
              <p className="text-green-800">{ticket.resolution_notes}</p>
              {ticket.resolved_at && (
                <p className="text-xs text-green-600 mt-2">
                  Resolved on {new Date(ticket.resolved_at).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
