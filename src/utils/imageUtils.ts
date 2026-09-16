export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  fit?: 'cover' | 'contain' | 'inside' | 'pad';
}

/**
 * Optimizes an image URL by applying transformation parameters for responsive, lightweight delivery.
 * Automatically handles ImageKit URLs (ik.imagekit.io) and Google CDN user avatars (googleusercontent.com).
 */
export function getOptimizedImageUrl(
  url?: string | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!url) return '';

  const {
    width = 150,
    height = 150,
    quality = 80,
    format = 'auto',
  } = options;

  // Handle ImageKit URLs
  if (url.includes('ik.imagekit.io')) {
    // Avoid double transforming if already contains transformation parameter
    if (url.includes('tr=') || url.includes('tr:')) {
      return url;
    }
    const trParams = [`w-${width}`, `h-${height}`, `q-${quality}`, `f-${format}`].join(',');
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=${trParams}`;
  }

  // Handle Google OAuth profile photo URLs
  if (url.includes('googleusercontent.com')) {
    // Google photo URLs standardly end with '=s96-c' or similar size specifier
    if (/=s\d+(-c)?$/.test(url)) {
      return url.replace(/=s\d+(-c)?$/, `=s${width}-c`);
    }
    return `${url}=s${width}-c`;
  }

  return url;
}

/**
 * Convenience helper to format avatar thumbnails (e.g. 64x64 or 128x128).
 */
export function getAvatarUrl(url?: string | null, size: number = 80): string {
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    quality: 80,
    format: 'auto',
  });
}
