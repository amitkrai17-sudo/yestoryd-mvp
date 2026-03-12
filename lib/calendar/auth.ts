/**
 * Google Calendar auth client — single source of truth
 * All calendar modules import getCalendarClient from here.
 */

import { google, calendar_v3 } from 'googleapis';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

// Email to impersonate (must have domain-wide delegation)
export const CALENDAR_EMAIL = process.env.GOOGLE_CALENDAR_EMAIL || COMPANY_CONFIG.supportEmail;

// For coaching sessions, fall back to DEFAULT_COACH_EMAIL so a coach is always organizer
export const DEFAULT_COACH_ORGANIZER = process.env.DEFAULT_COACH_EMAIL || CALENDAR_EMAIL;

/**
 * Create a Google Calendar client, optionally impersonating a specific user.
 * Defaults to GOOGLE_CALENDAR_DELEGATED_USER (engage@yestoryd.com) for discovery calls etc.
 */
export function getCalendarClient(impersonateEmail?: string): calendar_v3.Calendar {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientOptions: {
      subject: impersonateEmail || process.env.GOOGLE_CALENDAR_DELEGATED_USER || COMPANY_CONFIG.supportEmail,
    },
  });

  return google.calendar({ version: 'v3', auth });
}
