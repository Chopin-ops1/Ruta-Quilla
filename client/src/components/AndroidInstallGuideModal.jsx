import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Download,
  FolderOpen,
  Settings,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { fxRouteFound, fxTap } from '../utils/soundAndHaptics';

export const INSTALL_GUIDE_SKIP_KEY = 'rutaquilla_skip_install_guide_v1';

export function shouldSkipInstallGuide() {
  try {
    return localStorage.getItem(INSTALL_GUIDE_SKIP_KEY) === 'true';
  } catch {
    return false;
  }
}

export function triggerApkDownload(url = '/downloads/RutaQuilla.apk') {
  try {
    const a = document.createElement('a');
    a.href = url || '/downloads/RutaQuilla.apk';
    a.setAttribute('download', 'RutaQuilla.apk');
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url || '/downloads/RutaQuilla.apk', '_blank', 'noopener,noreferrer');
  }
}

const STEPS = [
  {
    num: 1,
    icon: Download,
    title: 'Descarga la app oficial',
    desc: 'Toca "Descargar RutaQuilla" abajo. Si el navegador pregunta "¿Descargar de todos modos?", confirma con tranquilidad.',
  },
  {
    num: 2,
    icon: FolderOpen,
    title: 'Abre el archivo descargado',
    desc: 'Toca el aviso "Descarga completa" arriba en tu pantalla o búscalo en Descargas de tu navegador.',
  },
  {
    num: 3,
    icon: Settings,
    title: 'Activa el permiso (solo la primera vez)',
    desc: 'Si Android pide autorización, toca Configuración, enciende el interruptor y regresa atrás.',
    showTogglePreview: true,
  },
  {
    num: 4,
    icon: CheckCircle2,
    title: 'Toca Instalar y listo',
    desc: 'Si aparece una alerta de Play Protect, toca "Más detalles → Instalar de todas formas". Después se actualizará directo desde la app.',
  },
];

export default function AndroidInstallGuideModal({
  isOpen,
  downloadUrl = '/downloads/RutaQuilla.apk',
  onClose,
}) {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(() => shouldSkipInstallGuide());

  useEffect(() => {
    if (isOpen) {
      setDownloadStarted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSkip = (checked) => {
    setDontShowAgain(checked);
    try {
      if (checked) {
        localStorage.setItem(INSTALL_GUIDE_SKIP_KEY, 'true');
      } else {
        localStorage.removeItem(INSTALL_GUIDE_SKIP_KEY);
      }
    } catch {
      // Ignorado si almacenamiento restringido
    }
  };

  const handleStartDownload = () => {
    fxRouteFound();
    triggerApkDownload(downloadUrl);
    setDownloadStarted(true);
  };

  const handleClose = () => {
    fxTap();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.62)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rq-install-guide-title"
    >
      <div
        className="w-full max-w-[440px] rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Cabecera de confianza */}
        <div
          className="px-5 pt-5 pb-4 flex items-start justify-between gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(31, 157, 107, 0.14), rgba(255, 194, 26, 0.1))',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2"
              style={{ background: 'var(--mangle-soft)', color: 'var(--mangle)' }}
            >
              <ShieldCheck size={13} />
              App oficial de RutaQuilla · Segura y verificada
            </div>
            <h2
              id="rq-install-guide-title"
              className="font-display text-[17px] font-extrabold leading-snug m-0 flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
            >
              <Smartphone size={17} color="var(--brand)" className="flex-shrink-0" />
              <span>Cómo instalar en tu Android</span>
            </h2>
            <p className="text-[12px] leading-snug m-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Al instalar directo desde nuestra web, Android pide confirmar un permiso una sola vez. Es normal y rápido:
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar guía de instalación"
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer border-0"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Pasos */}
        <div className="p-4 sm:p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="flex items-start gap-3 p-2.5 rounded-xl"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold mt-0.5"
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  {step.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} color="var(--mangle)" className="flex-shrink-0" />
                    <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-snug m-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {step.desc}
                  </p>
                  {step.showTogglePreview && (
                    <div
                      className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid color-mix(in srgb, var(--mangle) 35%, var(--border-color))',
                      }}
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
                  )}
                </div>
              </div>
            );
          })}

          {downloadStarted && (
            <div
              className="p-2.5 rounded-xl flex items-center gap-2 text-[12px] font-semibold animate-fade-in"
              style={{
                background: 'var(--mangle-soft)',
                color: 'var(--mangle)',
                border: '1px solid color-mix(in srgb, var(--mangle) 40%, transparent)',
              }}
            >
              <CheckCircle2 size={15} className="flex-shrink-0" />
              <span>Descarga iniciada · Sigue los pasos 2 a 4 arriba cuando termine.</span>
            </div>
          )}

          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => handleToggleSkip(e.target.checked)}
              className="rounded cursor-pointer"
              style={{ accentColor: 'var(--brand)' }}
            />
            <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              No volver a mostrar esta guía al descargar
            </span>
          </label>
        </div>

        {/* Acciones */}
        <div
          className="px-5 py-3.5 flex items-center justify-between gap-2.5"
          style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="rq-btn-secondary px-3.5 py-2 text-xs font-semibold"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleStartDownload}
            className="rq-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 flex-1 justify-center"
          >
            <Download size={14} />
            {downloadStarted ? 'Volver a descargar' : 'Descargar RutaQuilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
