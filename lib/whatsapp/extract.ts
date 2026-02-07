// ============================================================
// FILE: lib/whatsapp/extract.ts
// ============================================================
// Extract and normalize messages/statuses from Meta webhook payload
// Converts all message types into a flat ExtractedMessage[]
// ============================================================

import type {
  WebhookPayload,
  IncomingMessage,
  ExtractedMessage,
  ExtractedStatus,
  TextMessage,
  ButtonMessage,
  InteractiveMessage,
  ImageMessage,
  AudioMessage,
  VideoMessage,
  DocumentMessage,
  LocationMessage,
} from './types';

/**
 * Extract all messages from a webhook payload into normalized format
 */
export function extractMessages(payload: WebhookPayload): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      if (!value.messages?.length) continue;

      // Build contact name lookup
      const contactMap = new Map<string, string>();
      if (value.contacts) {
        for (const contact of value.contacts) {
          contactMap.set(contact.wa_id, contact.profile?.name || '');
        }
      }

      for (const msg of value.messages) {
        const extracted = extractSingleMessage(msg, contactMap);
        if (extracted) {
          messages.push(extracted);
        }
      }
    }
  }

  return messages;
}

/**
 * Extract all statuses from a webhook payload
 */
export function extractStatuses(payload: WebhookPayload): ExtractedStatus[] {
  const statuses: ExtractedStatus[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      if (!value.statuses?.length) continue;

      for (const status of value.statuses) {
        statuses.push({
          messageId: status.id,
          status: status.status,
          timestamp: status.timestamp,
          recipientId: status.recipient_id,
          errors: status.errors,
        });
      }
    }
  }

  return statuses;
}

/**
 * Normalize a single incoming message into ExtractedMessage
 */
function extractSingleMessage(
  msg: IncomingMessage,
  contactMap: Map<string, string>
): ExtractedMessage | null {
  const base: ExtractedMessage = {
    from: msg.from,
    messageId: msg.id,
    timestamp: msg.timestamp,
    type: msg.type,
    text: null,
    contactName: contactMap.get(msg.from) || '',
    interactiveId: null,
    interactiveTitle: null,
    mediaId: null,
    isReply: !!msg.context?.id,
    replyToId: msg.context?.id || null,
  };

  switch (msg.type) {
    case 'text': {
      const m = msg as TextMessage;
      base.text = m.text.body;
      break;
    }

    case 'button': {
      const m = msg as ButtonMessage;
      base.text = m.button.text;
      base.interactiveId = m.button.payload;
      base.interactiveTitle = m.button.text;
      break;
    }

    case 'interactive': {
      const m = msg as InteractiveMessage;
      if (m.interactive.type === 'button_reply' && m.interactive.button_reply) {
        base.interactiveId = m.interactive.button_reply.id;
        base.interactiveTitle = m.interactive.button_reply.title;
        base.text = m.interactive.button_reply.title;
      } else if (m.interactive.type === 'list_reply' && m.interactive.list_reply) {
        base.interactiveId = m.interactive.list_reply.id;
        base.interactiveTitle = m.interactive.list_reply.title;
        base.text = m.interactive.list_reply.title;
      }
      break;
    }

    case 'image': {
      const m = msg as ImageMessage;
      base.mediaId = m.image.id;
      base.text = m.image.caption || null;
      break;
    }

    case 'audio': {
      const m = msg as AudioMessage;
      base.mediaId = m.audio.id;
      break;
    }

    case 'video': {
      const m = msg as VideoMessage;
      base.mediaId = m.video.id;
      base.text = m.video.caption || null;
      break;
    }

    case 'document': {
      const m = msg as DocumentMessage;
      base.mediaId = m.document.id;
      base.text = m.document.caption || m.document.filename || null;
      break;
    }

    case 'location': {
      const m = msg as LocationMessage;
      base.text = m.location.name || m.location.address ||
        `${m.location.latitude},${m.location.longitude}`;
      break;
    }

    default:
      // Unknown message type - still extract base info
      break;
  }

  return base;
}
