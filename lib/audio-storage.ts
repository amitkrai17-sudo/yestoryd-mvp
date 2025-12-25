// file: lib/audio-storage.ts
// Download and store session audio from Recall.ai to Supabase Storage

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';
const STORAGE_BUCKET = 'session-audio';

interface AudioDownloadResult {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  error?: string;
}

async function getRecallRecordingUrl(botId: string): Promise<string | null> {
  if (!RECALL_API_KEY) return null;

  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      headers: { 'Authorization': `Token ${RECALL_API_KEY}` },
    });

    if (!response.ok) return null;

    const botData = await response.json();
    
    if (botData.recordings && botData.recordings.length > 0) {
      const rec = botData.recordings[0];
      return rec.media_shortcuts?.audio?.url || rec.media_shortcuts?.video?.url || null;
    }

    return botData.video_url || null;
  } catch (error) {
    console.error('Error fetching Recall bot details:', error);
    return null;
  }
}

export async function downloadAndStoreAudio(
  botId: string,
  sessionId: string,
  childId: string,
  sessionDate: string
): Promise<AudioDownloadResult> {
  try {
    console.log(`📥 Downloading audio for bot ${botId}`);

    const recordingUrl = await getRecallRecordingUrl(botId);
    
    if (!recordingUrl) {
      return { success: false, error: 'No recording URL available from Recall.ai' };
    }

    const audioResponse = await fetch(recordingUrl);
    
    if (!audioResponse.ok) {
      return { success: false, error: `Failed to download audio: ${audioResponse.status}` };
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Uint8Array(audioBuffer);

    console.log(`📦 Downloaded ${(audioBlob.length / 1024 / 1024).toFixed(2)} MB`);

    const dateFolder = sessionDate.substring(0, 7);
    const storagePath = `${childId}/${dateFolder}/${sessionId}.mp3`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Audio stored: ${storagePath}`);

    const { data: signedData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

    return {
      success: true,
      storagePath: storagePath,
      publicUrl: signedData?.signedUrl,
    };

  } catch (error: any) {
    console.error('Error in downloadAndStoreAudio:', error);
    return { success: false, error: error.message };
  }
}

export async function getAudioSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (error) return null;
    return data.signedUrl;
  } catch (error) {
    return null;
  }
}
