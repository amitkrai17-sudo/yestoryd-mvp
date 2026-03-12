// ============================================================================
// COMPANY CONFIG
// lib/config/company-config.ts
// ============================================================================
//
// Centralized constants for company contact info (emails, phones, URLs).
// Import from here instead of hardcoding across routes and components.
//
// For values that MUST be admin-editable at runtime, use site_settings table.
// This file covers stable identity constants that rarely change.
//
// ============================================================================

export const COMPANY_CONFIG = {
  // Lead Bot — website-facing WhatsApp for prospects
  leadBotWhatsApp: '918591287997',
  leadBotWhatsAppDisplay: '+91 8591 287 997',

  // AiSensy — outbound templates for enrolled parents/coaches
  aiSensyWhatsApp: '918976287997',

  // Emails
  supportEmail: 'engage@yestoryd.com',
  senderEmail: { email: 'engage@yestoryd.com', name: 'Yestoryd' } as const,
  // All system emails use supportEmail — no separate system address
  adminEmail: process.env.ADMIN_EMAIL || 'amitkrai17@yestoryd.com',
  adminWhatsApp: process.env.ADMIN_WHATSAPP_PHONE || '919687606177',

  websiteUrl: 'https://yestoryd.com',
} as const;
