'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: string;
  user_type: 'parent' | 'coach';
  user_email: string;
  user_name: string;
  child_name?: string;
  category: string;
  subject?: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

const CATEGORIES: Record<string, string> = {
  session_issue: 'Session Issue',
  payment_billing: 'Payment / Billing',
  technical_problem: 'Technical Problem',
  coach_feedback: 'Coach Feedback',
  schedule_change: 'Schedule Change',
  program_question: 'Program Question',
  other: 'Other',
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: X },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
};

interface SupportTicketsTabProps {
  adminEmail: string;
}

export default function SupportTicketsTab({ adminEmail }: SupportTicketsTabProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams({
        email: adminEmail,
        admin: 'true',
        status: statusFilter,
      });

      const response = await fetch(`/api/support/tickets?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string, notes?: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: notes,
          assigned_to: adminEmail,
        }),
      });

      if (response.ok) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(prev => prev ? { ...prev, status: newStatus as any } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        ticket.ticket_number.toLowerCase().includes(query) ||
        ticket.user_name.toLowerCase().includes(query) ||
        ticket.user_email.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Tickets</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
              <p className="text-xs text-gray-500">Open</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              <p className="text-xs text-gray-500">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Support Tickets</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map((ticket) => {
              const statusConfig = STATUS_CONFIG[ticket.status];
              const priorityConfig = PRIORITY_CONFIG[ticket.priority];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ticket.user_type === 'parent' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      <User className={`w-5 h-5 ${
                        ticket.user_type === 'parent' ? 'text-purple-600' : 'text-blue-600'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-gray-500">{ticket.ticket_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {ticket.priority !== 'normal' && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                        )}
                      </div>

                      <p className="font-medium text-gray-900 truncate">
                        {ticket.subject || CATEGORIES[ticket.category] || ticket.category}
                      </p>

                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{ticket.user_name}</span>
                        <span>•</span>
                        <span className="capitalize">{ticket.user_type}</span>
                        <span>•</span>
                        <span>{getTimeAgo(ticket.created_at)}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-500">{selectedTicket.ticket_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTicket.status].color}`}>
                    {STATUS_CONFIG[selectedTicket.status].label}
                  </span>
                </div>
                <h2 className="font-semibold text-gray-900 mt-1">
                  {selectedTicket.subject || CATEGORIES[selectedTicket.category]}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* User Info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedTicket.user_type === 'parent' ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  <User className={`w-6 h-6 ${
                    selectedTicket.user_type === 'parent' ? 'text-purple-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedTicket.user_name}</p>
                  <p className="text-sm text-gray-500">{selectedTicket.user_email}</p>
                  {selectedTicket.child_name && (
                    <p className="text-sm text-gray-500">Child: {selectedTicket.child_name}</p>
                  )}
                </div>
                <a
                  href={`mailto:${selectedTicket.user_email}`}
                  className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Send Email"
                >
                  <Mail className="w-4 h-4 text-gray-600" />
                </a>
                <a
                  href={`https://wa.me/${selectedTicket.user_email.includes('@') ? '' : selectedTicket.user_email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-green-100 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                  title="WhatsApp"
                >
                  <ExternalLink className="w-4 h-4 text-green-600" />
                </a>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900">{CATEGORIES[selectedTicket.category] || selectedTicket.category}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl mt-1">
                    {selectedTicket.description}
                  </p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <p className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[selectedTicket.priority].color}`}>
                      {PRIORITY_CONFIG[selectedTicket.priority].label}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Update Status:</span>
                {(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateTicketStatus(selectedTicket.id, status)}
                    disabled={updating || selectedTicket.status === status}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedTicket.status === status
                        ? STATUS_CONFIG[status].color
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}