// ============================================================
// FILE: lib/whatsapp/types.ts
// ============================================================
// Meta WhatsApp Cloud API v21.0 TypeScript Types
// Lead Bot on +91 85912 87997 (PHONE_NUMBER_ID: 1055529114299828)
//
// Covers:
// - Incoming webhook payloads (messages + statuses)
// - Outgoing message types (text, buttons, list, template)
// - Normalized ExtractedMessage for internal processing
// ============================================================

// ============================================================
// CONVERSATION STATES
// ============================================================

export type ConversationState =
  | 'GREETING'
  | 'QUALIFYING'
  | 'COLLECTING_CHILD_AGE'
  | 'COLLECTING_CONCERNS'
  | 'ASSESSMENT_OFFERED'
  | 'DISCOVERY_OFFERED'
  | 'NURTURING'
  | 'ESCALATED'
  | 'COMPLETED';

// ============================================================
// INCOMING WEBHOOK TYPES (Meta Cloud API v21.0)
// ============================================================

export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: 'messages';
}

export interface WebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: IncomingMessage[];
  statuses?: MessageStatus[];
  errors?: WebhookError[];
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

// ============================================================
// INCOMING MESSAGE TYPES
// ============================================================

export type IncomingMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'button'
  | 'interactive';

export interface IncomingMessageBase {
  from: string;
  id: string;
  timestamp: string;
  type: IncomingMessageType;
  context?: {
    from: string;
    id: string; // message being replied to
  };
}

export interface TextMessage extends IncomingMessageBase {
  type: 'text';
  text: {
    body: string;
  };
}

export interface ButtonMessage extends IncomingMessageBase {
  type: 'button';
  button: {
    payload: string;
    text: string;
  };
}

export interface InteractiveMessage extends IncomingMessageBase {
  type: 'interactive';
  interactive: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface ImageMessage extends IncomingMessageBase {
  type: 'image';
  image: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
}

export interface AudioMessage extends IncomingMessageBase {
  type: 'audio';
  audio: {
    id: string;
    mime_type: string;
  };
}

export interface VideoMessage extends IncomingMessageBase {
  type: 'video';
  video: {
    id: string;
    mime_type: string;
    caption?: string;
  };
}

export interface DocumentMessage extends IncomingMessageBase {
  type: 'document';
  document: {
    id: string;
    mime_type: string;
    filename?: string;
    caption?: string;
  };
}

export interface LocationMessage extends IncomingMessageBase {
  type: 'location';
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export type IncomingMessage =
  | TextMessage
  | ButtonMessage
  | InteractiveMessage
  | ImageMessage
  | AudioMessage
  | VideoMessage
  | DocumentMessage
  | LocationMessage;

// ============================================================
// MESSAGE STATUS TYPES
// ============================================================

export interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: 'business_initiated' | 'user_initiated' | 'referral_conversion';
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WebhookError[];
}

// ============================================================
// EXTRACTED MESSAGE (Normalized internal format)
// ============================================================

export interface ExtractedMessage {
  from: string;
  messageId: string;
  timestamp: string;
  type: IncomingMessageType;
  text: string | null;
  contactName: string;
  interactiveId: string | null;
  interactiveTitle: string | null;
  mediaId: string | null;
  isReply: boolean;
  replyToId: string | null;
}

export interface ExtractedStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipientId: string;
  errors?: WebhookError[];
}

// ============================================================
// OUTGOING MESSAGE TYPES
// ============================================================

export interface SendTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface SendButtonMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: {
          id: string;       // max 256 chars
          title: string;    // max 20 chars
        };
      }>; // max 3 buttons
    };
  };
}

export interface SendListMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      button: string; // max 20 chars, button label
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;         // max 200 chars
          title: string;      // max 24 chars
          description?: string; // max 72 chars
        }>;
      }>;
    };
  };
}

export interface SendTemplateMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: 'header' | 'body' | 'button';
      parameters?: Array<{
        type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
        text?: string;
        image?: { link: string };
      }>;
      sub_type?: 'quick_reply' | 'url';
      index?: number;
    }>;
  };
}

export type OutgoingMessage =
  | SendTextMessage
  | SendButtonMessage
  | SendListMessage
  | SendTemplateMessage;

// ============================================================
// CLOUD API RESPONSE
// ============================================================

export interface CloudApiResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface CloudApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
    error_data?: {
      messaging_product: string;
      details: string;
    };
  };
}

// ============================================================
// SEND RESULT (internal)
// ============================================================

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// DATABASE ROW TYPES (matches migration schema)
// ============================================================

export interface WaLeadConversation {
  id: string;
  phone_number: string;
  current_state: ConversationState;
  collected_data: Record<string, unknown>;
  lead_score: number;
  is_bot_active: boolean;
  assigned_agent: string | null;
  consent_given: boolean;
  consent_given_at: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  child_id: string | null;
  discovery_call_id: string | null;
}

export interface WaLeadMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'user' | 'bot' | 'agent';
  content: string;
  message_type: string;
  wa_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WaLead {
  id: string;
  phone_number: string;
  parent_name: string | null;
  child_name: string | null;
  child_age: number | null;
  reading_concerns: string | null;
  urgency: string | null;
  city: string | null;
  school: string | null;
  source: string;
  status: string;
  lead_score: number;
  conversation_id: string | null;
  child_id: string | null;
  discovery_call_id: string | null;
  enrollment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
