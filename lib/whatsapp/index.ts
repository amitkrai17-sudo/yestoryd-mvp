// ============================================================
// FILE: lib/whatsapp/index.ts
// ============================================================
// Barrel export for WhatsApp Lead Bot
// ============================================================

// Types
export type {
  ConversationState,
  WebhookPayload,
  WebhookEntry,
  WebhookChange,
  WebhookValue,
  WebhookContact,
  WebhookError,
  IncomingMessage,
  IncomingMessageType,
  TextMessage,
  ButtonMessage,
  InteractiveMessage,
  ImageMessage,
  AudioMessage,
  VideoMessage,
  DocumentMessage,
  LocationMessage,
  MessageStatus,
  ExtractedMessage,
  ExtractedStatus,
  SendTextMessage,
  SendButtonMessage,
  SendListMessage,
  SendTemplateMessage,
  OutgoingMessage,
  CloudApiResponse,
  CloudApiError,
  SendResult,
  WaLeadConversation,
  WaLeadMessage,
  WaLead,
} from './types';

// Signature verification
export { verifyWebhookSignature } from './signature';

// Message extraction
export { extractMessages, extractStatuses } from './extract';

// Cloud API client
export {
  sendText,
  sendTextWithPreview,
  sendButtons,
  sendList,
  sendTemplate,
  markAsRead,
} from './cloud-api';
