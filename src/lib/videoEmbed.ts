/**
 * Extracts video ID and returns embed URL for YouTube or Google Drive
 */
export function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube Shorts
  if (url.includes('youtube.com/shorts/')) {
    const match = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }

  // YouTube standard
  if (url.includes('youtube.com/watch')) {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }

  // YouTube short URL
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }

  // Google Drive
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  }

  return url;
}
