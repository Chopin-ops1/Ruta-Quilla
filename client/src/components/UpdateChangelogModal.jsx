import { useState, useEffect } from 'react';
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
  Loader2,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { isNativeApp } from '../utils/platform';
import { fxRouteFound, fxTap } from '../utils/soundAndHaptics';
import {
  DEFAULT_APK_DOWNLOAD_URL,
  DEFAULT_RELEASE_NOTES,
  startInAppAndroidUpdate,
  retryInstallDownloadedUpdate,
} from '../config/appVersion';

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

function formatMb(bytes) {
  const num = Number(bytes) || 0;
  if (num <= 0) return '0.0 MB';
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UpdateChangelogModal({
  isOpen,
  mode = 'changelog',
  release,
  installedVersion,
  onClose,
  onDownloadUpdate,
}) {
  const [updateState, setUpdateState] = useState('idle'); // 'idle' | 'downloading' | 'permission_required' | 'error'
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUpdateState('idle');
      setProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setErrorMsg('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const native = isNativeApp();
  const data = release && release.versionName ? release : DEFAULT_RELEASE_NOTES;
  const isUpdateMode = mode === 'update';
  const downloadUrl = data.downloadUrl || DEFAULT_APK_DOWNLOAD_URL;
  const highlights = Array.isArray(data.highlights) && data.highlights.length > 0
    ? data.highlights
    : DEFAULT_RELEASE_NOTES.highlights;

  const handleDownload = async () => {
    fxRouteFound();
    if (typeof onDownloadUpdate === 'function') {
      onDownloadUpdate(downloadUrl);
      return;
    }
    if (!native) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setUpdateState('downloading');
    setProgress(2);
    setErrorMsg('');
    try {
      const res = await startInAppAndroidUpdate(downloadUrl, (evt) => {
        if (typeof evt?.progress === 'number') setProgress(evt.progress);
        if (typeof evt?.downloadedBytes === 'number') setDownloadedBytes(evt.downloadedBytes);
        if (typeof evt?.totalBytes === 'number') setTotalBytes(evt.totalBytes);
      });

      if (res?.status === 'unsupported') {
        setUpdateState('idle');
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (res?.status === 'permission_required') {
        setUpdateState('permission_required');
        return;
      }
      setUpdateState('idle');
    } catch (err) {
      setUpdateState('error');
      setErrorMsg(err?.message || 'No se pudo completar la descarga. Verifica tu conexión.');
    }
  };

  const handleRetryInstall = async () => {
    fxTap();
    setErrorMsg('');
    try {
      const res = await retryInstallDownloadedUpdate();
      if (res?.status === 'permission_required') {
        setUpdateState('permission_required');
      } else {
        setUpdateState('idle');
      }
    } catch (err) {
      setUpdateState('error');
      setErrorMsg(err?.message || 'No se pudo iniciar la instalación.');
    }
  };

  const handleClose = () => {
    if (updateState === 'downloading') return;
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
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2"
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

          {updateState !== 'downloading' && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar aviso"
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer border-0"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-3.5 max-h-[62vh] overflow-y-auto">
          {data.summary && (
            <p className="text-[13px] leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
              {data.summary}
            </p>
          )}

          {updateState === 'downloading' && (
            <div
              className="p-3 rounded-xl space-y-2"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" color="var(--brand)" />
                  Descargando actualización...
                </span>
                <span className="font-mono tabular-nums" style={{ color: 'var(--brand)' }}>
                  {progress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(4, progress)}%`, background: 'var(--brand)' }}
                />
              </div>
              {totalBytes > 0 && (
                <div className="text-[10.5px] font-mono text-right" style={{ color: 'var(--text-muted)' }}>
                  {formatMb(downloadedBytes)} / {formatMb(totalBytes)}
                </div>
              )}
            </div>
          )}

          {updateState === 'permission_required' && (
            <div
              className="p-3 rounded-xl space-y-1.5"
              style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand)' }}>
                <Settings size={14} />
                Permiso necesario para instalar
              </div>
              <p className="text-[12px] leading-snug m-0" style={{ color: 'var(--text-primary)' }}>
                Activa el permiso para permitir actualizaciones de RutaQuilla en tu teléfono y luego toca <strong>Instalar actualización</strong>.
              </p>
            </div>
          )}

          {updateState === 'error' && errorMsg && (
            <div
              className="p-3 rounded-xl flex items-start gap-2"
              style={{ background: 'var(--carnaval-soft)', border: '1px solid var(--carnaval)' }}
            >
              <AlertCircle size={15} color="var(--carnaval)" className="flex-shrink-0 mt-0.5" />
              <p className="text-[12px] leading-snug m-0" style={{ color: 'var(--carnaval)' }}>
                {errorMsg}
              </p>
            </div>
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
            updateState === 'permission_required' ? (
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
                  onClick={handleRetryInstall}
                  className="rq-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 flex-1 justify-center"
                >
                  <CheckCircle2 size={14} />
                  Instalar actualización
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={updateState === 'downloading'}
                  onClick={handleClose}
                  className="rq-btn-secondary px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  Más tarde
                </button>
                <button
                  type="button"
                  disabled={updateState === 'downloading'}
                  onClick={handleDownload}
                  className="rq-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 flex-1 justify-center disabled:opacity-70"
                >
                  {updateState === 'downloading' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      {native ? 'Actualizar ahora' : 'Descargar actualización'}
                    </>
                  )}
                </button>
              </>
            )
          ) : (
            <>
              {!native && (
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
