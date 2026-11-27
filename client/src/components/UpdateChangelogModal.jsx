import {
  X,
  Download,
  Sparkles,
  ShieldCheck,
  Bus,
  Zap,
  Layout,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { isNativeApp } from '../utils/platform';
import { fxRouteFound, fxTap } from '../utils/soundAndHaptics';
import { DEFAULT_APK_DOWNLOAD_URL, DEFAULT_RELEASE_NOTES } from '../config/appVersion';

const CATEGORY_STYLE = {
  Seguridad: {
    icon: ShieldCheck,
    bg: 'var(--mangle-soft)',
    color: 'var(--mangle)',
  },
  Rutas: {
    icon: Bus,
    bg: 'var(--brand-soft)',
    color: 'var(--brand)',
  },
  Diseño: {
    icon: Layout,
    bg: 'var(--caribe-soft)',
    color: 'var(--caribe)',
  },
  Mejoras: {
    icon: Zap,
    bg: 'var(--carnaval-soft)',
    color: 'var(--carnaval)',
  },
};

function getCategoryMeta(category) {
  const key = Object.keys(CATEGORY_STYLE).find(
    (k) => k.toLowerCase() === String(category || '').trim().toLowerCase()
  );
  return CATEGORY_STYLE[key] || {
    icon: Sparkles,
    bg: 'var(--brand-soft)',
    color: 'var(--brand)',
  };
}

export default function UpdateChangelogModal({
  isOpen,
  mode = 'changelog',
  release,
  installedVersion,
  onClose,
  onDownloadUpdate,
}) {
  if (!isOpen) return null;

  const data = release && release.versionName ? release : DEFAULT_RELEASE_NOTES;
  const isUpdateMode = mode === 'update';
  const downloadUrl = data.downloadUrl || DEFAULT_APK_DOWNLOAD_URL;
  const highlights = Array.isArray(data.highlights) && data.highlights.length > 0
    ? data.highlights
    : DEFAULT_RELEASE_NOTES.highlights;

  const handleDownload = () => {
    fxRouteFound();
    if (typeof onDownloadUpdate === 'function') {
      onDownloadUpdate(downloadUrl);
    } else {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClose = () => {
    fxTap();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.58)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rq-release-modal-title"
    >
      <div
        className="w-full max-w-[440px] rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
        }}
      >
        {/* Cabecera */}
        <div
          className="px-5 pt-5 pb-4 flex items-start justify-between gap-3"
          style={{
            background: isUpdateMode
              ? 'linear-gradient(135deg, rgba(235, 169, 42, 0.14), rgba(20, 184, 166, 0.08))'
              : 'linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(235, 169, 42, 0.08))',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2"
              style={{
                background: isUpdateMode ? 'var(--brand-soft)' : 'var(--mangle-soft)',
                color: isUpdateMode ? 'var(--brand)' : 'var(--mangle)',
              }}
            >
              {isUpdateMode ? <Download size={12} /> : <Sparkles size={12} />}
              {isUpdateMode
                ? `Nueva versión disponible · v${data.versionName}`
                : `Qué hay de nuevo · v${data.versionName}`}
            </div>
            <h2
              id="rq-release-modal-title"
              className="font-display text-[17px] font-extrabold leading-snug m-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {data.title || `RutaQuilla ${data.versionName}`}
            </h2>
            {isUpdateMode && installedVersion && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                <span>Tu versión: v{installedVersion}</span>
                <ArrowRight size={12} />
                <span className="font-bold" style={{ color: 'var(--mangle)' }}>v{data.versionName}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar aviso"
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer border-0"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-3.5 max-h-[62vh] overflow-y-auto">
          {data.summary && (
            <p className="text-[13px] leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
              {data.summary}
            </p>
          )}

          <div className="space-y-2">
            {highlights.map((item, idx) => {
              const meta = getCategoryMeta(item.category);
              const Icon = meta.icon;
              return (
                <div
                  key={`${item.category}-${idx}`}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                      {item.category || 'Mejoras'}
                    </div>
                    <p className="text-[12.5px] leading-snug m-0 mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones */}
        <div
          className="px-5 py-3.5 flex items-center justify-between gap-2.5 flex-wrap"
          style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
        >
          {isUpdateMode ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rq-btn-secondary px-3.5 py-2 text-xs font-semibold"
              >
                Más tarde
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rq-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 flex-1 justify-center"
              >
                <Download size={14} />
                Descargar actualización
              </button>
            </>
          ) : (
            <>
              {!isNativeApp() && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fxTap()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold no-underline px-2.5 py-1.5 rounded-lg"
                  style={{ color: 'var(--mangle)', background: 'var(--mangle-soft)' }}
                >
                  <Smartphone size={13} />
                  App Android
                </a>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rq-btn-primary px-5 py-2 text-xs font-bold inline-flex items-center gap-1.5 ml-auto"
              >
                <CheckCircle2 size={14} />
                Entendido
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
