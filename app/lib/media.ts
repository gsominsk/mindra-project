/**
 * Get the base URL for media files (images, videos)
 * Uses environment variable to support different paths in dev/production
 */
export function getMediaUrl(path: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || '/media';

    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Ensure baseUrl doesn't end with slash
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    return `${cleanBaseUrl}/${cleanPath}`;
}
