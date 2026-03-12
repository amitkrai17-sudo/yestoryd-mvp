// =============================================================================
// ARTIFACT STORAGE UTILITY
// lib/storage/artifact-storage.ts
//
// Upload child artifacts to Supabase Storage with sharp image processing.
// Pipeline: original → compressed/resized (2048px max) → thumbnail (200px).
// Returns relative storage paths (not absolute URLs).
//
// Pattern follows lib/audio-storage.ts (admin client, bucket upload, signed URLs).
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import sharp from 'sharp';
import { loadArtifactConfig, type ArtifactConfig } from '@/lib/config/artifact-config';

const STORAGE_BUCKET = 'child-artifacts';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// =============================================================================
// TYPES
// =============================================================================

export interface ArtifactUploadInput {
  childId: string;
  fileBuffer: Buffer | Uint8Array;
  mimeType: string;
  fileName: string;
  artifactType: 'drawing' | 'writing' | 'photo' | 'worksheet' | 'other';
  sessionId?: string;
  enrollmentId?: string;
}

export interface ArtifactUploadResult {
  success: boolean;
  originalUri?: string;
  processedUri?: string;
  thumbnailUri?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  imageWidth?: number;
  imageHeight?: number;
  error?: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

// =============================================================================
// IMAGE PROCESSING
// =============================================================================

interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

async function processImage(
  input: Buffer | Uint8Array,
  maxDimension: number,
  quality = 85,
): Promise<ProcessedImage> {
  const image = sharp(Buffer.from(input));
  const metadata = await image.metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // Only resize if exceeds max dimension
  const needsResize = width > maxDimension || height > maxDimension;

  let pipeline = image;
  if (needsResize) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Always convert to webp for processed/thumbnails
  pipeline = pipeline.webp({ quality });

  const buffer = await pipeline.toBuffer();
  const outputMeta = await sharp(buffer).metadata();

  return {
    buffer,
    width: outputMeta.width || width,
    height: outputMeta.height || height,
  };
}

async function generateThumbnail(
  input: Buffer | Uint8Array,
  dimension: number,
): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .resize(dimension, dimension, {
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 70 })
    .toBuffer();
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function buildStoragePath(
  childId: string,
  prefix: 'original' | 'processed' | 'thumb',
  fileName: string,
  ext: string,
): string {
  const dateFolder = new Date().toISOString().substring(0, 7); // YYYY-MM
  const cleanName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const uniqueId = Date.now().toString(36);
  return `${childId}/${dateFolder}/${prefix}/${cleanName}_${uniqueId}.${ext}`;
}

function getExtensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}

// =============================================================================
// MAIN UPLOAD FUNCTION
// =============================================================================

/**
 * Upload a child artifact with image processing pipeline.
 *
 * For images: uploads original, creates processed version (max 2048px), creates thumbnail (200px).
 * For PDFs: uploads original only (no processing).
 *
 * Returns relative storage paths (not absolute URLs).
 * Use `getArtifactSignedUrl()` to generate signed URLs when needed.
 */
export async function uploadArtifact(input: ArtifactUploadInput): Promise<ArtifactUploadResult> {
  const supabase = createAdminClient();
  let config: ArtifactConfig;

  try {
    config = await loadArtifactConfig();
  } catch {
    // Use hardcoded defaults if config fails
    config = {
      artifact_max_file_size_bytes: 10485760,
      artifact_image_max_dimension: 2048,
      artifact_thumbnail_dimension: 200,
      artifact_analysis_model: 'gemini-2.5-flash',
      artifact_retention_original_days: 365,
      artifact_retention_processed_days: -1,
    };
  }

  // Validate MIME type
  if (!isAllowedMimeType(input.mimeType)) {
    return { success: false, error: `Unsupported file type: ${input.mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }

  // Validate file size
  const fileSize = input.fileBuffer.length;
  if (fileSize > config.artifact_max_file_size_bytes) {
    const maxMB = (config.artifact_max_file_size_bytes / 1024 / 1024).toFixed(0);
    return { success: false, error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum: ${maxMB} MB` };
  }

  const ext = getExtensionForMime(input.mimeType);

  try {
    // 1. Upload original
    const originalPath = buildStoragePath(input.childId, 'original', input.fileName, ext);

    const { error: originalErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(originalPath, input.fileBuffer, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (originalErr) {
      return { success: false, error: `Original upload failed: ${originalErr.message}` };
    }

    let processedUri: string | undefined;
    let thumbnailUri: string | undefined;
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;

    // 2. Process images (skip PDFs)
    if (isImageMime(input.mimeType)) {
      try {
        // Processed version (max dimension, webp)
        const processed = await processImage(
          input.fileBuffer,
          config.artifact_image_max_dimension,
        );

        const processedPath = buildStoragePath(input.childId, 'processed', input.fileName, 'webp');

        const { error: processedErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(processedPath, processed.buffer, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (!processedErr) {
          processedUri = processedPath;
          imageWidth = processed.width;
          imageHeight = processed.height;
        }

        // Thumbnail (square crop, 200px)
        const thumbBuffer = await generateThumbnail(
          input.fileBuffer,
          config.artifact_thumbnail_dimension,
        );

        const thumbPath = buildStoragePath(input.childId, 'thumb', input.fileName, 'webp');

        const { error: thumbErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(thumbPath, thumbBuffer, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (!thumbErr) {
          thumbnailUri = thumbPath;
        }
      } catch (imgErr) {
        // Image processing failed — original is still uploaded
        console.error('[ArtifactStorage] Image processing failed:', imgErr instanceof Error ? imgErr.message : 'Unknown');
      }

      // Get original image dimensions if not set from processing
      if (!imageWidth) {
        try {
          const meta = await sharp(Buffer.from(input.fileBuffer)).metadata();
          imageWidth = meta.width || undefined;
          imageHeight = meta.height || undefined;
        } catch {
          // Non-critical
        }
      }
    }

    return {
      success: true,
      originalUri: originalPath,
      processedUri,
      thumbnailUri,
      mimeType: input.mimeType,
      fileSizeBytes: fileSize,
      imageWidth,
      imageHeight,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown upload error' };
  }
}

// =============================================================================
// SIGNED URL HELPER
// =============================================================================

/**
 * Generate a signed URL for an artifact storage path.
 * Default expiry: 1 hour.
 */
export async function getArtifactSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) return null;
  return data.signedUrl;
}

/**
 * Generate signed URLs for all artifact variants (original, processed, thumbnail).
 */
export async function getArtifactSignedUrls(artifact: {
  original_uri: string;
  processed_uri?: string | null;
  thumbnail_uri?: string | null;
}, expiresInSeconds = 3600): Promise<{
  originalUrl: string | null;
  processedUrl: string | null;
  thumbnailUrl: string | null;
}> {
  const [originalUrl, processedUrl, thumbnailUrl] = await Promise.all([
    getArtifactSignedUrl(artifact.original_uri, expiresInSeconds),
    artifact.processed_uri ? getArtifactSignedUrl(artifact.processed_uri, expiresInSeconds) : null,
    artifact.thumbnail_uri ? getArtifactSignedUrl(artifact.thumbnail_uri, expiresInSeconds) : null,
  ]);

  return { originalUrl, processedUrl, thumbnailUrl };
}

/**
 * Delete an artifact and all its variants from storage.
 */
export async function deleteArtifactFiles(artifact: {
  original_uri: string;
  processed_uri?: string | null;
  thumbnail_uri?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const paths = [artifact.original_uri];
  if (artifact.processed_uri) paths.push(artifact.processed_uri);
  if (artifact.thumbnail_uri) paths.push(artifact.thumbnail_uri);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    console.error('[ArtifactStorage] Delete failed:', error.message);
  }
}
