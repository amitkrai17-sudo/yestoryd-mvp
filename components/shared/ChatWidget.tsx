// ============================================================
// CHAT WIDGET COMPONENT
// File: components/shared/ChatWidget.tsx
// Real-time chat between parents and coaches
// ============================================================

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Paperclip, X, Image as ImageIcon, 
  File, Loader2, Check, CheckCheck, AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  child_id: string;
  sender_type: 'parent' | 'coach' | 'admin' | 'system';
  sender_id: string;
  sender_name: string;
  message_text: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachment_url?: string;
  attachment_name?: string;
  is_read: boolean;
  created_at: string;
}

interface ChatWidgetProps {
  childId: string;
  childName: string;
  currentUserType: 'parent' | 'coach' | 'admin';
  currentUserId: string;
  otherPartyName?: string;
  className?: string;
  compact?: boolean;
}

export default function ChatWidget({
  childId,
  childName,
  currentUserType,
  currentUserId,
  otherPartyName,
  className = '',
  compact = false,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async (before?: string) => {
    try {
      const url = `/api/messages?child_id=${childId}${before ? `&before=${before}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      
      if (before) {
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        setMessages(data.messages);
      }
      
      setHasMore(data.has_more);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 10 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMessages]);

  // Mark messages as read
  useEffect(() => {
    const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== currentUserId);
    
    if (unreadMessages.length > 0) {
      fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          message_ids: unreadMessages.map(m => m.id),
        }),
      }).catch(console.error);
    }
  }, [messages, childId, currentUserId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          message_text: messageText,
          message_type: 'text',
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      setMessages(prev => [...prev, data.message]);
    } catch (err: any) {
      setError(err.message);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: currentDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className={`flex flex-col bg-white rounded-xl border border-gray-200 ${compact ? 'h-[400px]' : 'h-[600px]'} ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-blue-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              {otherPartyName ? `Chat with ${otherPartyName}` : `Chat - ${childName}`}
            </h3>
            <p className="text-sm text-gray-600">
              {currentUserType === 'parent' ? 'Message your coach' : `About ${childName}`}
            </p>
          </div>
          {/* Online indicator could go here */}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Send className="w-6 h-6 text-gray-400" />
            </div>
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation!</p>
          </div>
        ) : (
          <>
            {/* Load more button */}
            {hasMore && (
              <button
                onClick={() => fetchMessages(messages[0]?.created_at)}
                className="w-full py-2 text-sm text-pink-600 hover:text-pink-700"
              >
                Load earlier messages
              </button>
            )}

            {/* Message groups */}
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                    {new Date(group.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>

                {/* Messages */}
                {group.messages.map((msg, msgIndex) => {
                  const isOwn = msg.sender_id === currentUserId;
                  const showSender = !isOwn && (
                    msgIndex === 0 || 
                    group.messages[msgIndex - 1].sender_id !== msg.sender_id
                  );

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                      <div className={`max-w-[75%] ${isOwn ? 'order-1' : ''}`}>
                        {/* Sender name */}
                        {showSender && (
                          <div className="text-xs text-gray-500 mb-1 ml-2">
                            {msg.sender_name}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div
                          className={`
                            px-4 py-2 rounded-2xl
                            ${isOwn 
                              ? 'bg-pink-600 text-white rounded-br-md' 
                              : msg.sender_type === 'system'
                                ? 'bg-gray-100 text-gray-600 italic'
                                : 'bg-gray-100 text-gray-900 rounded-bl-md'
                            }
                          `}
                        >
                          {/* Attachment preview */}
                          {msg.attachment_url && (
                            <div className="mb-2">
                              {msg.message_type === 'image' ? (
                                <img 
                                  src={msg.attachment_url} 
                                  alt="Attachment" 
                                  className="max-w-full rounded-lg"
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`
                                    flex items-center gap-2 p-2 rounded-lg
                                    ${isOwn ? 'bg-pink-500' : 'bg-white border border-gray-200'}
                                  `}
                                >
                                  <File className="w-4 h-4" />
                                  <span className="text-sm truncate">
                                    {msg.attachment_name || 'Download file'}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Message text */}
                          <p className="whitespace-pre-wrap break-words">
                            {msg.message_text}
                          </p>
                        </div>

                        {/* Timestamp and read status */}
                        <div className={`flex items-center gap-1 mt-1 text-xs text-gray-400 ${isOwn ? 'justify-end mr-2' : 'ml-2'}`}>
                          <span>{formatTime(msg.created_at)}</span>
                          {isOwn && (
                            msg.is_read 
                              ? <CheckCheck className="w-3 h-3 text-blue-500" />
                              : <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Attach file (coming soon)"
            disabled
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 max-h-32"
              style={{ minHeight: '42px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className={`
              p-2 rounded-xl transition-colors
              ${newMessage.trim() && !isSending
                ? 'bg-pink-600 text-white hover:bg-pink-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// COMPACT CHAT PREVIEW (For listings)
// =====================================================
export function ChatPreview({
  childId,
  childName,
  lastMessage,
  unreadCount,
  onClick,
}: {
  childId: string;
  childName: string;
  lastMessage?: Message;
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
    >
      {/* Avatar placeholder */}
      <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
        <span className="text-pink-600 font-medium">
          {childName.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900 truncate">{childName}</span>
          {lastMessage && (
            <span className="text-xs text-gray-400">
              {new Date(lastMessage.created_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-sm text-gray-500 truncate">
            {lastMessage.sender_type === 'system' ? (
              <span className="italic">{lastMessage.message_text}</span>
            ) : (
              <>
                {lastMessage.sender_name}: {lastMessage.message_text}
              </>
            )}
          </p>
        )}
      </div>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="px-2 py-0.5 bg-pink-600 text-white text-xs rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
