/**
 * Unified Memory-Safe Client Media Upload Service (Phase E)
 * 
 * Flow:
 * 1. Authorize: Request short-lived signed ImageKit parameters & tenant-scoped folder from Q2 backend.
 * 2. Direct Upload: Upload file directly from browser to ImageKit CDN (bypassing Node.js server RAM).
 * 3. Confirm: Send verified fileId & URL to Q2 backend to persist MediaMetadata and link asset.
 * 4. Fallback: If direct CDN upload fails or in mock environment, safely fall back to server-streamed upload.
 */

import { api } from '@/lib/api';
import axios from 'axios';

export type UploadCategory =
  | 'PROFILE_PHOTO'
  | 'MESS_LEAVE_DOCUMENT'
  | 'FEE_RECEIPT'
  | 'ORGANIZATION_LOGO'
  | 'ORGANIZATION_AADHAAR'
  | 'GENERAL_MEDIA';

export interface UploadOptions {
  category: UploadCategory;
  resourceId?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadResult {
  url: string;
  fileId: string;
  name: string;
  size: number;
  thumbnailUrl?: string;
}

/**
 * Uploads a file using the Phase E direct-to-ImageKit pipeline with graceful server fallback.
 */
export async function uploadMedia(file: File, options: UploadOptions): Promise<UploadResult> {
  const { category, resourceId, onProgress } = options;

  // 1. Client-Side Size & Type Pre-validation
  const MAX_SIZES: Record<UploadCategory, number> = {
    PROFILE_PHOTO: 3 * 1024 * 1024,
    MESS_LEAVE_DOCUMENT: 5 * 1024 * 1024,
    FEE_RECEIPT: 5 * 1024 * 1024,
    ORGANIZATION_LOGO: 2 * 1024 * 1024,
    ORGANIZATION_AADHAAR: 5 * 1024 * 1024,
    GENERAL_MEDIA: 10 * 1024 * 1024,
  };

  const maxSize = MAX_SIZES[category] || 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File exceeds the maximum allowable size of ${(maxSize / 1024 / 1024).toFixed(1)} MB`);
  }

  try {
    // 2. Authorize Upload: Obtain signed ImageKit parameters and tenant folder from Q2 backend
    const authRes = await api.post('/upload/authorize', {
      category,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      resourceId,
    });

    const { auth, params, uploadMode } = authRes.data;

    // Check if direct ImageKit upload is viable
    if (uploadMode === 'DIRECT_IMAGEKIT' && auth && auth.publicKey && auth.publicKey !== 'dummy_public_key') {
      try {
        const ikFormData = new FormData();
        ikFormData.append('file', file);
        ikFormData.append('fileName', params.fileName);
        ikFormData.append('publicKey', auth.publicKey);
        ikFormData.append('signature', auth.signature);
        ikFormData.append('expire', String(auth.expire));
        ikFormData.append('token', auth.token);
        ikFormData.append('folder', params.folder);
        ikFormData.append('useUniqueFileName', 'true');

        const ikRes = await axios.post(auth.uploadEndpoint || 'https://upload.imagekit.io/api/v1/files/upload', ikFormData, {
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(percent);
            }
          },
        });

        const { url, fileId, name, size, thumbnailUrl } = ikRes.data;

        // 3. Confirm with Q2 backend
        await api.post('/upload/confirm', {
          fileId,
          url,
          thumbnailUrl,
          fileName: name,
          size,
          mimeType: file.type,
          category,
          resourceId,
        });

        return { url, fileId, name, size, thumbnailUrl };
      } catch (directUploadErr) {
        console.warn('[UploadService] Direct ImageKit upload encountered an error; attempting server fallback:', directUploadErr);
      }
    }
  } catch (authErr) {
    console.warn('[UploadService] Upload authorization failed; attempting legacy server upload:', authErr);
  }

  // 4. Memory-Safe Server Fallback
  const fallbackData = new FormData();
  fallbackData.append('file', file);
  if (resourceId) fallbackData.append('resourceId', resourceId);

  const fallbackRes = await api.post('/upload/file', fallbackData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return {
    url: fallbackRes.data.url,
    fileId: fallbackRes.data.fileId,
    name: fallbackRes.data.name || file.name,
    size: fallbackRes.data.size || file.size,
  };
}
