import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
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
  checkCanInstallPackages,
  openAndroidInstallPermissionSettings,
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
  onOpenInstallGuide,
}) {
  const [updateState, setUpdateState] = useState('idle'); // 'idle' | 'downloading' | 'permission_required' | 'error'
  const [installPerm, setInstallPerm] = useState('checking'); // 'checking' | 'granted' | 'needed' | 'unsupported'
  const [permBannerJustGranted, setPermBannerJustGranted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const waitingForPermissionReturnRef = useRef(false);
  const downloadedReadyRef = useRef(false);

  const native = isNativeApp();
  const data = release && release.versionName ? release : DEFAULT_RELEASE_NOTES;
  const isUpdateMode = mode === 'update';
  const downloadUrl = data.downloadUrl || DEFAULT_APK_DOWNLOAD_URL;
  const highlights = Array.isArray(data.highlights) && data.highlights.length > 0
    ? data.highlights
    : DEFAULT_RELEASE_NOTES.highlights;

  const handleRetryInstall = useCallback(async () => {
    fxTap();
    setErrorMsg('');
    try {
      const res = await retryInstallDownloadedUpdate();
      if (res?.status === 'permission_required') {
        waitingForPermissionReturnRef.current = true;
        setInstallPerm('needed');
        setUpdateState('permission_required');
      } else {
        setUpdateState('idle');
      }
    } catch (err) {
      setUpdateState('error');
      setErrorMsg(err?.message || 'No se pudo iniciar la instalación.');
    }
  }, []);

  const handleDownload = useCallback(async () => {
    fxRouteFound();
    if (typeof onDownloadUpdate === 'function') {
      onDownloadUpdate(downloadUrl);
      return;
    }
    if (!native) {
      if (typeof onOpenInstallGuide === 'function') {
        onOpenInstallGuide();
      } else {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      }
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
        downloadedReadyRef.current = Boolean(res?.fileReady);
        waitingForPermissionReturnRef.current = true;
        setInstallPerm('needed');
        setUpdateState('permission_required');
        return;
      }
      setUpdateState('idle');
    } catch (err) {
      setUpdateState('error');
      setErrorMsg(err?.message || 'No se pudo completar la descarga. Verifica tu conexión.');
    }
  }, [native, downloadUrl, onDownloadUpdate, onOpenInstallGuide]);

  const recheckPermission = useCallback(async () => {
    if (!native || !isUpdateMode) return;
    const perm = await checkCanInstallPackages();
    if (!perm.supported) {
      setInstallPerm('unsupported');
      return;
    }
    if (perm.granted) {
      setInstallPerm('granted');
      if (waitingForPermissionReturnRef.current) {
        waitingForPermissionReturnRef.current = false;
        setPermBannerJustGranted(true);
        if (downloadedReadyRef.current) {
          handleRetryInstall();
        } else {
          handleDownload();
        }
      }
    } else {
      setInstallPerm('needed');
    }
  }, [native, isUpdateMode, handleRetryInstall, handleDownload]);

  useEffect(() => {
    if (!isOpen) return;
    setUpdateState('idle');
    setPermBannerJustGranted(false);
    setProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setErrorMsg('');
    waitingForPermissionReturnRef.current = false;
    downloadedReadyRef.current = false;

    if (native && isUpdateMode) {
      setInstallPerm('checking');
      checkCanInstallPackages().then((perm) => {
        if (!perm.supported) {
          setInstallPerm('unsupported');
        } else {
          setInstallPerm(perm.granted ? 'granted' : 'needed');
        }
      });
    } else {
      setInstallPerm('granted');
    }
  }, [isOpen, mode, native, isUpdateMode]);

  useEffect(() => {
    if (!isOpen || !native || !isUpdateMode) return undefined;

    let capListener = null;
    const onActive = () => {
      recheckPermission();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheckPermission();
    };

    window.addEventListener('focus', onActive);
    document.addEventListener('visibilitychange', onVisibility);
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) recheckPermission();
    })
      .then((handle) => {
        capListener = handle;
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('focus', onActive);
      document.removeEventListener('visibilitychange', onVisibility);
      if (capListener && typeof capListener.remove === 'function') {
        capListener.remove().catch(() => {});
      }
    };
  }, [isOpen, native, isUpdateMode, recheckPermission]);

  if (!isOpen) return null;

  const handleOpenPermissionSettings = async () => {
    fxTap();
    waitingForPermissionReturnRef.current = true;
    await openAndroidInstallPermissionSettings();
  };

  const handleClose = () => {
    if (updateState === 'downloading') return;
    fxTap();
    onClose?.();
  };

  const showOneTimePermissionGuide =
    native && isUpdateMode && installPerm === 'needed' && updateState === 'idle';

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

          {permBannerJustGranted && (
            <div
              className="p-2.5 rounded-xl flex items-center gap-2 text-[12px] font-semibold animate-fade-in"
              style={{
                background: 'var(--mangle-soft)',
                color: 'var(--mangle)',
                border: '1px solid color-mix(in srgb, var(--mangle) 40%, transparent)',
              }}
            >
              <CheckCircle2 size={15} className="flex-shrink-0" />
              <span>Permiso activado · Continuando actualización dentro de RutaQuilla.</span>
            </div>
          )}

          {showOneTimePermissionGuide && (
            <div
              className="p-3.5 rounded-xl space-y-2.5 animate-fade-in"
              style={{
                background: 'var(--brand-soft)',
                border: '1px solid color-mix(in srgb, var(--brand) 45%, transparent)',
              }}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold" style={{ color: 'var(--brand)' }}>
                <Settings size={14} />
                <span>Paso único para actualizar desde la app</span>
              </div>
              <p className="text-[12px] leading-snug m-0" style={{ color: 'var(--text-primary)' }}>
                Android necesita tu autorización una sola vez para que RutaQuilla pueda actualizarse directo aquí sin volver al navegador.
              </p>
              <ol className="m-0 pl-4 space-y-1 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                <li>Toca <strong>Activar permiso en Ajustes</strong> abajo.</li>
                <li>Enciende <strong>Permitir desde esta fuente</strong>.</li>
                <li>Vuelve atrás y la actualización continuará sola.</li>
              </ol>
              <div
                className="px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Permitir desde esta fuente
                </span>
                <span
                  className="inline-flex items-center rounded-full p-0.5"
                  style={{ width: 32, height: 18, background: 'var(--mangle)', justifyContent: 'flex-end' }}
                  aria-hidden="true"
                >
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#FFFFFF' }} />
                </span>
              </div>
            </div>
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
              className="p-3 rounded-xl space-y-2"
              style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand)' }}>
                <Settings size={14} />
                Permiso necesario para instalar
              </div>
              <p className="text-[12px] leading-snug m-0" style={{ color: 'var(--text-primary)' }}>
                Activa <strong>Permitir desde esta fuente</strong> en los ajustes que se acaban de abrir y regresa para terminar la instalación.
              </p>
              <button
                type="button"
                onClick={handleOpenPermissionSettings}
                className="rq-chip"
                style={{ padding: '5px 10px', fontSize: 11, color: 'var(--brand)' }}
              >
                <Settings size={12} /> Abrir Ajustes otra vez
              </button>
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
            ) : showOneTimePermissionGuide ? (
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
                  onClick={handleOpenPermissionSettings}
                  className="rq-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 flex-1 justify-center"
                >
                  <Settings size={14} />
                  Activar permiso en Ajustes
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
                <button
                  type="button"
                  onClick={() => {
                    fxTap();
                    if (typeof onOpenInstallGuide === 'function') {
                      onClose?.();
                      onOpenInstallGuide();
                    } else {
                      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 cursor-pointer"
                  style={{ color: 'var(--mangle)', background: 'var(--mangle-soft)' }}
                >
                  <Smartphone size={13} />
                  App Android
                </button>
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
