/**
 * Environment Variable Validation
 * 
 * Validates required environment variables on application startup
 * Provides clear error messages for missing configuration
 * 
 * Import this in your root layout or middleware to validate on startup:
 * import '@/lib/env-check';
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
}

// ==================== CONFIGURATION ====================

const ENV_VARS: EnvVar[] = [
  // Supabase (Required)
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validator: (v) => v.startsWith('https://') && v.includes('.supabase.co'),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validator: (v) => v.startsWith('eyJ'),
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (server-side only)',
    validator: (v) => v.startsWith('eyJ'),
  },

  // Gemini AI (Required)
  {
    name: 'GEMINI_API_KEY',
    required: true,
    description: 'Google Gemini API key',
    validator: (v) => v.startsWith('AIza'),
  },

  // Google Calendar (Required for scheduling)
  {
    name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    required: true,
    description: 'Google service account email',
    validator: (v) => v.includes('@') && v.includes('.iam.gserviceaccount.com'),
  },
  {
    name: 'GOOGLE_PRIVATE_KEY',
    required: true,
    description: 'Google service account private key',
    validator: (v) => v.includes('BEGIN PRIVATE KEY'),
  },
  {
    name: 'GOOGLE_CALENDAR_DELEGATED_USER',
    required: true,
    description: 'Google Calendar delegated user email',
    validator: (v) => v.includes('@'),
  },

  // Razorpay (Required for payments)
  {
    name: 'RAZORPAY_KEY_ID',
    required: true,
    description: 'Razorpay Key ID',
    validator: (v) => v.startsWith('rzp_'),
  },
  {
    name: 'RAZORPAY_KEY_SECRET',
    required: true,
    description: 'Razorpay Key Secret',
  },
  {
    name: 'RAZORPAY_WEBHOOK_SECRET',
    required: false,
    description: 'Razorpay Webhook Secret (for payment verification)',
  },

  // SendGrid (Required for emails)
  {
    name: 'SENDGRID_API_KEY',
    required: true,
    description: 'SendGrid API key',
    validator: (v) => v.startsWith('SG.'),
  },
  {
    name: 'SENDGRID_FROM_EMAIL',
    required: false,
    description: 'SendGrid sender email address',
  },

  // Application URLs
  {
    name: 'NEXT_PUBLIC_BASE_URL',
    required: false,
    description: 'Base URL of the application',
  },

  // Optional: OpenAI (Fallback AI)
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key (fallback for AI analysis)',
    validator: (v) => v.startsWith('sk-'),
  },

  // Optional: Twilio (WhatsApp)
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio Account SID',
    validator: (v) => v.startsWith('AC'),
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio Auth Token',
  },
  {
    name: 'TWILIO_WHATSAPP_NUMBER',
    required: false,
    description: 'Twilio WhatsApp number',
  },

  // Optional: tl;dv (Meeting transcription)
  {
    name: 'TLDV_API_KEY',
    required: false,
    description: 'tl;dv API key for meeting transcription',
  },
];

// ==================== VALIDATION LOGIC ====================

interface ValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

export function validateEnvVars(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    missing: [],
    invalid: [],
    warnings: [],
  };

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    // Check if required variable is missing
    if (envVar.required && !value) {
      result.missing.push(`${envVar.name}: ${envVar.description}`);
      result.valid = false;
      continue;
    }

    // Check if optional variable is missing (warning only)
    if (!envVar.required && !value) {
      result.warnings.push(`${envVar.name}: ${envVar.description} (optional, not set)`);
      continue;
    }

    // Validate format if validator exists
    if (value && envVar.validator && !envVar.validator(value)) {
      result.invalid.push(`${envVar.name}: Invalid format`);
      result.valid = false;
    }
  }

  return result;
}

// ==================== STARTUP CHECK ====================

export function checkEnvOnStartup() {
  // Skip in edge runtime (doesn't have full process.env)
  if (typeof process === 'undefined') return;
  
  // Skip on client side
  if (typeof window !== 'undefined') return;

  const result = validateEnvVars();

  if (result.missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
    result.missing.forEach((msg) => console.error(`   - ${msg}`));
  }

  if (result.invalid.length > 0) {
    console.error('\n⚠️ INVALID ENVIRONMENT VARIABLE FORMAT:');
    result.invalid.forEach((msg) => console.error(`   - ${msg}`));
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('\n📝 OPTIONAL VARIABLES NOT SET:');
    result.warnings.forEach((msg) => console.warn(`   - ${msg}`));
  }

  if (!result.valid) {
    console.error('\n💡 Please check your .env.local file or Vercel environment variables.\n');
    
    // In production, throw to prevent startup with missing config
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Application cannot start: Missing required environment variables');
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('\n✅ All required environment variables are set.\n');
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get an environment variable with a default value
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue || '';
}

/**
 * Get an environment variable, returning undefined if not set
 */
export function getEnvOptional(name: string): string | undefined {
  return process.env[name];
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// ==================== AUTO-RUN ON IMPORT ====================

// Run validation when this module is imported (server-side only)
if (typeof window === 'undefined') {
  checkEnvOnStartup();
}
