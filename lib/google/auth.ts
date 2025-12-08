/**
 * Google Authentication Client
 * Sets up authentication for all Google APIs
 */

import { google } from 'googleapis';

let authClient: any = null;
let authError: string | null = null;

/**
 * Get authenticated Google API client
 */
export function getAuthClient() {
  if (authError) {
    throw new Error(authError);
  }
  
  if (authClient) {
    return authClient;
  }

  // Check if we have service account credentials
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    authError = 'Missing Google service account credentials';
    console.log('Google Sheets not configured - running without database');
    throw new Error(authError);
  }

  try {
    // Fix the private key format - handle different escape formats
    let formattedKey = privateKey;
    
    // Replace literal \n with actual newlines
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // If the key is wrapped in quotes, remove them
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
      formattedKey = formattedKey.slice(1, -1);
    }

    // Create auth client with service account
    authClient = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: formattedKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    return authClient;
  } catch (error: any) {
    authError = `Google Auth Error: ${error.message}`;
    console.error('Failed to initialize Google Auth:', error);
    throw new Error(authError);
  }
}

/**
 * Check if Google Sheets is configured
 */
export function isGoogleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID
  );
}

/**
 * Get Google Sheets client
 */
export function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Get Google Calendar client
 */
export function getCalendarClient() {
  const auth = getAuthClient();
  return google.calendar({ version: 'v3', auth });
}

/**
 * Get Google Drive client
 */
export function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Get Gmail client
 */
export function getGmailClient() {
  const auth = getAuthClient();
  return google.gmail({ version: 'v1', auth });
}
