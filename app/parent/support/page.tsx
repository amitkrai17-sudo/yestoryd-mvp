'use client';

import { useState, useEffect } from 'react';
import { useParentContext } from '@/app/parent/context';
import SupportForm from '@/components/support/SupportForm';
import { HelpCircle, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

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
  open: { label: 'Open', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: AlertCircle },
  resolved: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600 border border-gray-200', icon: CheckCircle },
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
  const { parent, selectedChild } = useParentContext();
  const parentEmail = parent?.email || '';
  const parentName = parent?.name || '';
  const childName = selectedChild?.child_name || selectedChild?.name || '';
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
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900">Support</h1>
          <p className="text-gray-500 text-sm mt-0.5">Get help with your questions and concerns</p>
        </div>

        {/* New Request Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full p-4 bg-[#FF0099] text-white rounded-xl font-semibold hover:bg-[#E6008A] transition-colors flex items-center justify-center gap-2 min-h-[48px]"
          >
            <HelpCircle className="w-5 h-5" />
            Submit New Request
          </button>
        )}

        {/* Support Form */}
        {showForm && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">New Support Request</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-600"
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
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Active Requests ({openTickets.length})
                </p>
                <div className="space-y-2">
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
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Resolved ({resolvedTickets.length})
                </p>
                <div className="space-y-2">
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
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h2 className="text-base font-medium text-gray-900 mb-1">No Support Requests</h2>
                <p className="text-gray-500 text-sm mb-4">You haven&apos;t submitted any requests yet.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[44px]"
                >
                  Submit Your First Request
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
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
    </div>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#FFD6E8] transition-colors text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {CATEGORY_LABELS[ticket.category] || ticket.category}
          </p>
          {ticket.subject && (
            <p className="text-xs text-gray-500 mt-1">{ticket.subject}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {new Date(ticket.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>
    </button>
  );
}

// Ticket Detail Modal
function TicketDetailModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <span className="text-xl text-gray-500">&times;</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Category</p>
            <p className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
          </div>

          {ticket.subject && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm text-gray-600">{ticket.subject}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Submitted</p>
            <p className="text-sm text-gray-600">
              {new Date(ticket.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>

          {ticket.resolution_notes && (
            <div className="bg-[#E8FCF1] border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 uppercase tracking-wider mb-1">Resolution</p>
              <p className="text-sm text-emerald-800">{ticket.resolution_notes}</p>
              {ticket.resolved_at && (
                <p className="text-xs text-emerald-600 mt-2">
                  Resolved on {new Date(ticket.resolved_at).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-medium hover:bg-gray-200 transition-colors min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
