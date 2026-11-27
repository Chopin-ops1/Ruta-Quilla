/**
 * Utilidades de detección de entorno nativo (Capacitor Android) y acciones del sistema.
 */

export function isNativeApp() {
  return Boolean(
    typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  );
}

export function isAndroidPlatform() {
  return Boolean(
    isNativeApp() && window.Capacitor?.getPlatform?.() === 'android'
  );
}

/**
 * Comparte un resumen de ruta usando el menú nativo del teléfono o WhatsApp.
 */
export async function shareRouteSummary({
  title = 'RutaQuilla',
  text,
  url = 'https://rutaquilla.me',
} = {}) {
  const fullMessage = [text, url].filter(Boolean).join('\n');

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'native' };
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, cancelled: true };
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullMessage);
    }
  } catch (_) {}

  try {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    return { ok: true, method: 'whatsapp' };
  } catch (_) {
    return { ok: true, method: 'clipboard' };
  }
}
