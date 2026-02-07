import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { GoogleAuth } from 'google-auth-library';

// Get credentials from environment
function getCredentials() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !serviceAccountEmail) {
    throw new Error('Missing Google Cloud credentials for TTS');
  }

  return {
    client_email: serviceAccountEmail,
    private_key: privateKey,
  };
}

// Initialize Google Cloud TTS client (for fallback)
function createTTSClient() {
  const credentials = getCredentials();
  return new TextToSpeechClient({ credentials });
}

// Age-based voice adjustments
function getVoiceConfig(age: number) {
  // Younger children: slower speed, higher pitch
  // Older children: normal speed, normal pitch
  if (age <= 6) {
    return {
      speakingRate: 0.85, // 15% slower
      pitch: 1.5, // Higher pitch for Neural2 (Gemini uses prompts)
    };
  } else if (age <= 9) {
    return {
      speakingRate: 0.92, // 8% slower
      pitch: 0.5, // Slightly higher pitch
    };
  } else {
    return {
      speakingRate: 1.0, // Normal speed
      pitch: 0, // Normal pitch
    };
  }
}

// Get prompt for age-appropriate tone
function getPrompt(age: number): string {
  if (age <= 7) {
    return 'Read aloud in a warm, encouraging tone for a young child';
  } else {
    return 'Read aloud in a friendly, clear tone';
  }
}

// Helper to get access token from service account
async function getAccessToken(): Promise<string> {
  const credentials = getCredentials();
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error('Failed to get access token');
  }

  return token.token;
}

export interface TTSOptions {
  text: string;
  age: number;
}

// Primary: Gemini Pro TTS with Kore voice
export async function generateSpeechGemini(options: TTSOptions): Promise<Buffer> {
  const voiceConfig = getVoiceConfig(options.age);
  const prompt = getPrompt(options.age);

  const accessToken = await getAccessToken();

  const response = await fetch('https://texttospeech.googleapis.com/v1beta1/text:synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      input: {
        text: options.text,
        prompt,
      },
      voice: {
        languageCode: 'en-IN',
        name: 'Kore',
        modelName: 'gemini-2.5-pro-tts',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: voiceConfig.speakingRate,
        pitch: 0, // Gemini handles tone via prompt, keep pitch neutral
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[TTS Gemini] Error:', error);
    throw new Error(`Gemini TTS failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.audioContent) {
    throw new Error('No audio content returned from Gemini TTS');
  }

  return Buffer.from(data.audioContent, 'base64');
}

// Fallback: Neural2 voice with age-adaptive selection
export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  const client = createTTSClient();
  const voiceConfig = getVoiceConfig(options.age);

  // Age-adaptive voice selection
  // Ages 4-7: Neural2-D (warm, nurturing)
  // Ages 8+: Neural2-A (clear, mature)
  const voiceName = options.age <= 7
    ? 'en-IN-Neural2-D'  // Warm, nurturing for younger children
    : 'en-IN-Neural2-A'; // Clear, mature for older children

  const request = {
    input: { text: options.text },
    voice: {
      languageCode: 'en-IN', // Indian English
      name: voiceName, // Age-adaptive voice
      ssmlGender: 'FEMALE' as const,
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: voiceConfig.speakingRate,
      pitch: voiceConfig.pitch,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content returned from Google TTS');
  }

  // audioContent is a Uint8Array, convert to Buffer
  return Buffer.from(response.audioContent as Uint8Array);
}
