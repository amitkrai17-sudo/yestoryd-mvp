'use client';

// ============================================================
// CommunicationTrigger — Reusable template-based message trigger
// ============================================================
// Coaches and admins can send template-based WhatsApp + email
// messages to parents from any context (session, enrollment, etc.)
// Uses bottom sheet (mobile-first), dark theme for coach portal.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mail,
  Phone,
  Check,
  X,
  Send,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

// ==================== TYPES ====================

interface Template {
  templateCode: string;
  name: string;
  description: string | null;
  channels: { whatsapp: boolean; email: boolean };
  variablePlaceholders: string[];
}

interface TriggerResult {
  success: boolean;
  templateName?: string;
  channels?: { channel: string; success: boolean; error?: string }[];
  error?: string;
}

export interface CommunicationTriggerProps {
  contextType: 'session' | 'enrollment' | 'tuition' | 'general';
  contextId?: string;
  recipientType: 'parent' | 'coach';
  recipientId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  variables?: Record<string, string>;
  userRole: 'coach' | 'admin';
  triggerLabel?: string;
  triggerVariant?: 'button' | 'icon-only';
  onMessageSent?: (result: { templateCode: string; channels: string[] }) => void;
}

// ==================== COMPONENT ====================

export function CommunicationTrigger({
  contextType,
  contextId,
  recipientType,
  recipientId,
  recipientName,
  recipientPhone,
  recipientEmail,
  variables,
  userRole,
  triggerLabel,
  triggerVariant = 'button',
  onMessageSent,
}: CommunicationTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<('whatsapp' | 'email')[]>([]);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom message state
  const [showCustom, setShowCustom] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [customSubject, setCustomSubject] = useState('Update from Yestoryd');

  const label = triggerLabel || (recipientType === 'parent' ? 'Message Parent' : 'Message Coach');

  // Fetch templates when bottom sheet opens
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/communication/templates-for-context?contextType=${contextType}`
      );
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        setError(data.error || 'Failed to load templates');
      }
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [contextType]);

  useEffect(() => {
    if (isOpen && templates.length === 0) {
      fetchTemplates();
    }
  }, [isOpen, templates.length, fetchTemplates]);

  // When a template is selected, default to all available channels
  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    const channels: ('whatsapp' | 'email')[] = [];
    if (template.channels.whatsapp) channels.push('whatsapp');
    if (template.channels.email) channels.push('email');
    setSelectedChannels(channels);
    setError(null);
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setShowCustom(false);
    setError(null);
  };

  // Send template message
  const handleSend = async () => {
    if (!selectedTemplate || selectedChannels.length === 0) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/communication/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCode: selectedTemplate.templateCode,
          recipientType,
          recipientId,
          recipientPhone,
          recipientEmail,
          recipientName,
          contextType,
          contextId,
          channelOverride: selectedChannels,
          customVariables: variables,
        }),
      });

      const data: TriggerResult = await res.json();

      if (data.success) {
        setSentSuccess(true);
        onMessageSent?.({
          templateCode: selectedTemplate.templateCode,
          channels: data.channels?.filter(c => c.success).map(c => c.channel) || [],
        });
        // Auto-close after 2s
        setTimeout(() => {
          setIsOpen(false);
          setSentSuccess(false);
          setSelectedTemplate(null);
        }, 2000);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSending(false);
    }
  };

  // Send custom email via Resend
  const handleSendCustomEmail = async () => {
    if (!customMessage.trim() || !recipientEmail) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/communication/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCode: 'custom_message',
          recipientType,
          recipientId,
          recipientEmail,
          recipientName,
          contextType,
          contextId,
          channelOverride: ['email'],
          customVariables: {
            ...variables,
            subject: customSubject,
            body: customMessage,
          },
        }),
      });

      const data: TriggerResult = await res.json();

      if (data.success) {
        setSentSuccess(true);
        onMessageSent?.({ templateCode: 'custom_email', channels: ['email'] });
        setTimeout(() => {
          setIsOpen(false);
          setSentSuccess(false);
          setShowCustom(false);
          setCustomMessage('');
        }, 2000);
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSending(false);
    }
  };

  // Open wa.me for custom WhatsApp (free, no AiSensy cost)
  const handleCustomWhatsApp = () => {
    if (!recipientPhone) return;
    const phone = recipientPhone.replace(/\D/g, '');
    const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const text = encodeURIComponent(customMessage || '');
    window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');

    onMessageSent?.({ templateCode: 'custom_whatsapp', channels: ['whatsapp_manual'] });
  };

  const toggleChannel = (channel: 'whatsapp' | 'email') => {
    setSelectedChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  // ==================== RENDER ====================

  // Success state on trigger button
  if (sentSuccess && !isOpen) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <Check className="w-3.5 h-3.5" />
        <span>Sent</span>
      </div>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      {triggerVariant === 'icon-only' ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
          title={label}
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white transition-colors min-h-[36px]"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{label}</span>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => {
            if (!sending) {
              setIsOpen(false);
              setSelectedTemplate(null);
              setShowCustom(false);
            }
          }}
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              {(selectedTemplate || showCustom) && (
                <button
                  onClick={handleBack}
                  className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-800 text-gray-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-white">
                {sentSuccess
                  ? 'Message Sent'
                  : showCustom
                    ? 'Custom Message'
                    : selectedTemplate
                      ? selectedTemplate.name
                      : `Message ${recipientName || recipientType}`}
              </h3>
            </div>
            <button
              onClick={() => {
                if (!sending) {
                  setIsOpen(false);
                  setSelectedTemplate(null);
                  setShowCustom(false);
                }
              }}
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-800 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Success State */}
            {sentSuccess && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-medium">Message sent successfully</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Template List */}
            {!selectedTemplate && !showCustom && !sentSuccess && (
              <>
                {loadingTemplates ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">No templates available for this context</p>
                  </div>
                ) : (
                  <>
                    {templates.map(template => (
                      <button
                        key={template.templateCode}
                        onClick={() => handleSelectTemplate(template)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left min-h-[52px]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {template.name}
                          </p>
                          {template.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {template.channels.whatsapp && (
                              <span className="flex items-center gap-1 text-[10px] text-green-400">
                                <Phone className="w-3 h-3" />
                                WhatsApp
                              </span>
                            )}
                            {template.channels.email && (
                              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                                <Mail className="w-3 h-3" />
                                Email
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
                      </button>
                    ))}

                    {/* Custom Message Option */}
                    <button
                      onClick={() => setShowCustom(true)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl border border-gray-700 border-dashed bg-transparent hover:bg-gray-800/30 transition-colors text-left min-h-[52px]"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-300">Custom Message</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Write a free-text message
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Selected Template — Confirm + Send */}
            {selectedTemplate && !sentSuccess && (
              <div className="space-y-4">
                {/* Channel toggles */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Send via</p>
                  <div className="flex gap-2">
                    {selectedTemplate.channels.whatsapp && (
                      <button
                        onClick={() => toggleChannel('whatsapp')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[40px] ${
                          selectedChannels.includes('whatsapp')
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                    )}
                    {selectedTemplate.channels.email && (
                      <button
                        onClick={() => toggleChannel('email')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[40px] ${
                          selectedChannels.includes('email')
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </button>
                    )}
                  </div>
                </div>

                {/* Recipient info */}
                <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700">
                  <p className="text-xs text-gray-400">Sending to</p>
                  <p className="text-sm text-white mt-0.5">{recipientName || 'Parent'}</p>
                  {recipientPhone && selectedChannels.includes('whatsapp') && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Phone className="w-3 h-3 inline mr-1" />
                      {recipientPhone}
                    </p>
                  )}
                  {recipientEmail && selectedChannels.includes('email') && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Mail className="w-3 h-3 inline mr-1" />
                      {recipientEmail}
                    </p>
                  )}
                </div>

                {/* Send CTA */}
                <button
                  onClick={handleSend}
                  disabled={sending || selectedChannels.length === 0}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                >
                  {sending ? (
                    <Spinner />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Custom Message Form */}
            {showCustom && !sentSuccess && (
              <div className="space-y-4">
                {/* Subject (for email) */}
                {recipientEmail && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email Subject</label>
                    <input
                      type="text"
                      value={customSubject}
                      onChange={e => setCustomSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      placeholder="Subject line"
                    />
                  </div>
                )}

                {/* Message body */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Message</label>
                  <textarea
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none"
                    placeholder={`Write your message to ${recipientName || 'parent'}...`}
                  />
                </div>

                {/* Send options */}
                <div className="flex gap-2">
                  {recipientPhone && (
                    <button
                      onClick={handleCustomWhatsApp}
                      disabled={!customMessage.trim()}
                      className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      WhatsApp
                    </button>
                  )}
                  {recipientEmail && (
                    <button
                      onClick={handleSendCustomEmail}
                      disabled={sending || !customMessage.trim()}
                      className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                    >
                      {sending ? (
                        <Spinner />
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Email
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-gray-500 text-center">
                  WhatsApp opens wa.me (free). Email sends via Resend.
                </p>
              </div>
            )}
          </div>

          {/* Safe area padding for mobile */}
          <div className="h-6" />
        </div>
      )}

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  );
}

export default CommunicationTrigger;
