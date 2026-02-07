import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechGemini, generateSpeech } from '@/lib/tts/google-tts';
import { z } from 'zod';

// Validation schema
const TTSRequestSchema = z.object({
  text: z.string().min(1).max(5000), // Max 5000 characters
  age: z.number().int().min(4).max(18), // Age range 4-18
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = TTSRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { text, age } = validation.data;

    let audioBuffer: Buffer;

    try {
      // Try Gemini Pro TTS first (Kore voice)
      console.log('[TTS] Attempting Gemini Pro TTS with Kore voice...');
      audioBuffer = await generateSpeechGemini({ text, age });
      console.log('[TTS] Gemini Pro TTS successful');
    } catch (geminiError) {
      console.warn('[TTS] Gemini failed, falling back to Neural2:', geminiError);
      // Fallback to standard Neural2
      audioBuffer = await generateSpeech({ text, age });
      console.log('[TTS] Fallback to Neural2 successful');
    }

    // Convert Buffer to Uint8Array for NextResponse
    const audioData = new Uint8Array(audioBuffer);

    // Return audio with caching headers (cache for 24 hours)
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.length.toString(),
        'Cache-Control': 'public, max-age=86400, immutable', // 24 hours
      },
    });
  } catch (error) {
    console.error('[TTS] API Error:', error);

    // Return error without exposing sensitive details
    return NextResponse.json(
      {
        error: 'Failed to generate speech',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET method not allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate speech.' },
    { status: 405 }
  );
}
