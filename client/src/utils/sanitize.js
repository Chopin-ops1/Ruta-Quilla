/**
 * Sanitizes text before injecting it into raw HTML templates
 * such as Leaflet L.divIcon strings.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates that a CSS color is a safe 3- or 6-digit hex color,
 * falling back to a default hex color otherwise.
 */
export function safeColor(color, fallback = '#F59E0B') {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
}
