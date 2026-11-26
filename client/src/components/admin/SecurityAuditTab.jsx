import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sliders,
  Save,
  Megaphone,
  Plus,
  X,
  LogOut,
  Unlock,
  UserX,
  Bot,
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CATEGORY_META = {
  all: { label: 'Todas', color: 'var(--text-secondary)' },
  route: { label: 'Rutas', color: 'var(--brand)' },
  user: { label: 'Usuarios', color: 'var(--caribe)' },
  capture: { label: 'Capturas', color: 'var(--mangle)' },
  report: { label: 'Reportes', color: 'var(--carnaval)' },
  security: { label: 'Seguridad', color: 'var(--carnaval)' },
  system: { label: 'Sistema', color: 'var(--caribe)' },
};

const SEARCH_LIMIT_PRESETS = [
  { value: 0, label: '0 (Solo registrados)' },
  { value: 1, label: '1' },
  { value: 3, label: '3 (Estándar)' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 999, label: 'Ilimitadas' },
];

export default function SecurityAuditTab({ refreshTick = 0 }) {
  const toast = useToast();
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null); // 'purge' | 'revoke' | 'unlock'
  const [purgePreviewCount, setPurgePreviewCount] = useState(null);
  const [runningAction, setRunningAction] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, lRes, cRes] = await Promise.all([
        adminAPI.getSystemHealth(),
        adminAPI.getAuditLogs({ category, page, limit: 20 }),
        adminAPI.getSecurityConfig(),
      ]);
      setHealth(hRes.data || null);
      setLogs(lRes.data || []);
      setTotalPages(lRes.totalPages || 1);
      setTotalLogs(lRes.total || 0);
      setConfig(cRes.data || null);
    } catch (err) {
      console.error('Error cargando seguridad:', err);
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshTick]);

  const handleSaveConfig = async (overridePatch = null) => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = overridePatch ? { ...config, ...overridePatch } : config;
      const res = await adminAPI.updateSecurityConfig(payload);
      setConfig(res.data || payload);
      toast.success('Configuración aplicada en vivo en toda la app');
      loadAll();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar la configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleField = (field) => {
    if (!config) return;
    setConfig((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAddBlockedDomain = () => {
    const clean = newBlockedDomain.trim().toLowerCase().replace(/^@+/, '');
    if (!clean || !clean.includes('.') || !/^[a-z0-9.-]+$/.test(clean)) {
      toast.warning('Ingresa un dominio válido (ej. tempmail.xyz)');
      return;
    }
    const existing = config?.blockedEmailDomains || [];
    if (existing.includes(clean)) {
      setNewBlockedDomain('');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      blockedEmailDomains: [...(prev.blockedEmailDomains || []), clean],
    }));
    setNewBlockedDomain('');
  };

  const handleRemoveBlockedDomain = (dom) => {
    setConfig((prev) => ({
      ...prev,
      blockedEmailDomains: (prev.blockedEmailDomains || []).filter((d) => d !== dom),
    }));
  };

  const handlePreparePurge = async () => {
    setRunningAction(true);
    try {
      const res = await adminAPI.purgeUnverifiedUsers({ olderThanDays: 7, dryRun: true });
      setPurgePreviewCount(res.eligibleCount ?? 0);
      setConfirmAction('purge');
    } catch (err) {
      toast.error(err.message || 'Error calculando cuentas elegibles');
    } finally {
      setRunningAction(false);
    }
  };

  const handleExecuteAction = async (type) => {
    setRunningAction(true);
    try {
      if (type === 'purge') {
        const res = await adminAPI.purgeUnverifiedUsers({ olderThanDays: 7, dryRun: false });
        toast.success(res.message || 'Cuentas limpiadas');
      } else if (type === 'revoke') {
        const res = await adminAPI.revokeAllSessions();
        toast.success(res.message || 'Sesiones cerradas');
      } else if (type === 'unlock') {
        const res = await adminAPI.unlockAccounts();
        toast.success(res.message || 'Cuentas desbloqueadas');
      }
      setConfirmAction(null);
      setPurgePreviewCount(null);
      loadAll();
    } catch (err) {
      toast.error(err.message || 'No se pudo ejecutar la acción');
    } finally {
      setRunningAction(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await adminAPI.clearCaches();
      toast.success('Cachés de mapas vaciadas');
      loadAll();
    } catch (err) {
      toast.error(err.message || 'Error al limpiar cachés');
    } finally {
      setClearing(false);
    }
  };

  const sec = health?.security || {};

  const securityChecks = [
    { label: 'JWT Secret robusto (>=32 chars)', ok: Boolean(sec.jwtStrongSecret) },
    { label: 'Bloqueo por fuerza bruta (5 intentos)', ok: Boolean(sec.accountLockout) },
    { label: 'Revocación de JWT por tokenVersion', ok: Boolean(sec.tokenRevocation) },
    { label: 'Sanitización NoSQL + Helmet CSP', ok: Boolean(sec.mongoSanitize && sec.helmetCSP) },
    { label: 'Borrado masivo de rutas bloqueado', ok: Boolean(sec.bulkWipeLocked) },
    { label: 'Verificación SMTP activa', ok: Boolean(sec.smtpConfigured) },
  ];

  const policySwitches = [
    {
      key: 'registrationEnabled',
      title: 'Permitir nuevos registros',
      desc: 'Activa o pausa el registro de usuarios nuevos en la app',
    },
    {
      key: 'botShieldEnabled',
      title: 'Escudo Anti-Bots en Auth',
      desc: 'Trampa honeypot invisible + token HMAC con tiempo mínimo y anti-replay',
    },
    {
      key: 'strictEmailValidation',
      title: 'Bloqueo estricto de correos y DNS MX',
      desc: 'Rechaza dominios desechables, typos (@gmai.com) y dominios sin servidor MX',
    },
    {
      key: 'requireEmailVerification',
      title: 'Exigir verificación OTP por email',
      desc: 'Impide usar cuentas nuevas sin validar el código de 6 dígitos',
    },
    {
      key: 'adminLogin2FA',
      title: 'Código 2FA al iniciar sesión como Admin',
      desc: 'Envía un código OTP de 6 dígitos a tu correo cada vez que entres como administrador',
    },
    {
      key: 'reportsEnabled',
      title: 'Reportes comunitarios en vivo',
      desc: 'Habilita o pausa el envío de incidencias y desvíos ciudadanos',
    },
    {
      key: 'capturesEnabled',
      title: 'Capturas GPS comunitarias',
      desc: 'Habilita o pausa la grabación de recorridos GPS por usuarios',
    },
  ];

  return (
    <div className="animate-fade-in p-3 sm:p-4 space-y-3.5 max-w-[1100px] mx-auto">
      {/* Controles Interactivos del Sitio y Seguridad */}
      <div className="rq-card p-3.5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sliders size={16} color="var(--brand)" />
            <div>
              <div className="font-display text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Controles de Seguridad y Operación en Vivo
              </div>
              <p className="text-[11px] m-0" style={{ color: 'var(--text-secondary)' }}>
                Activa o desactiva funciones clave de la página sin reiniciar servidores
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!config || savingConfig}
            onClick={() => handleSaveConfig()}
            className="rq-btn-primary text-xs"
            style={{ padding: '7px 14px' }}
          >
            {savingConfig ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{savingConfig ? 'Aplicando...' : 'Guardar cambios'}</span>
          </button>
        </div>

        {!config ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" color="var(--brand)" />
            <span>Cargando políticas del sitio...</span>
          </div>
        ) : (
          <>
            {/* Interruptores principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {policySwitches.map((item) => {
                const enabled = Boolean(config[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleField(item.key)}
                    className="text-left p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    style={{
                      background: 'var(--bg-surface)',
                      border: `1px solid ${enabled ? 'color-mix(in srgb, var(--mangle) 38%, var(--border-color))' : 'var(--border-color)'}`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        {item.desc}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 999,
                        padding: 2,
                        flexShrink: 0,
                        background: enabled ? 'var(--mangle)' : 'var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: enabled ? 'flex-end' : 'flex-start',
                        transition: 'background 0.2s',
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cloudflare Turnstile CAPTCHA opcional + Búsquedas gratis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
              {/* Límite de búsquedas sin registro */}
              <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Búsquedas gratis antes de pedir registro
                </div>
                <p className="text-[10.5px] m-0" style={{ color: 'var(--text-secondary)' }}>
                  Define cuántas navegaciones puede hacer un visitante sin cuenta
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SEARCH_LIMIT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, maxFreeSearches: preset.value }))}
                      className={`rq-chip${config.maxFreeSearches === preset.value ? ' active' : ''}`}
                      style={{ padding: '4px 9px', fontSize: 10.5 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CAPTCHA externo Cloudflare Turnstile */}
              <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Bot size={14} color="var(--brand)" />
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      Cloudflare Turnstile (CAPTCHA)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleField('turnstileEnabled')}
                    className="rq-chip"
                    style={{
                      padding: '3px 9px',
                      fontSize: 10.5,
                      background: config.turnstileEnabled ? 'var(--mangle-soft)' : 'var(--bg-card)',
                      color: config.turnstileEnabled ? 'var(--mangle)' : 'var(--text-muted)',
                    }}
                  >
                    {config.turnstileEnabled ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Turnstile Site Key (ej. 0x4AAAAAAA...)"
                  value={config.turnstileSiteKey || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, turnstileSiteKey: e.target.value }))}
                  className="rq-input w-full px-2.5 py-1.5 text-xs font-mono"
                />
                <p className="text-[10px] m-0 leading-relaxed" style={{ color: config.turnstileSecretConfigured ? 'var(--mangle)' : 'var(--text-muted)' }}>
                  {config.turnstileSecretConfigured
                    ? '✓ TURNSTILE_SECRET_KEY detectada en el servidor. Al activarlo aparecerá en Login y Registro.'
                    : 'Cómo activarlo gratis: entra a dash.cloudflare.com → Turnstile → Add Widget para rutaquilla.me, pega el Site Key aquí y agrega TURNSTILE_SECRET_KEY en Render.'}
                </p>
              </div>
            </div>

            {/* Banner Global de Aviso en la Página */}
            <div className="p-3 rounded-xl space-y-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Megaphone size={14} color="var(--brand)" />
                  <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    Cintillo / Banner de Aviso Global en la Página Principal
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleField('bannerEnabled')}
                  className="rq-chip"
                  style={{
                    padding: '4px 10px',
                    fontSize: 10.5,
                    background: config.bannerEnabled ? 'var(--brand-soft)' : 'var(--bg-card)',
                    color: config.bannerEnabled ? 'var(--brand)' : 'var(--text-muted)',
                  }}
                >
                  {config.bannerEnabled ? 'Banner Visible' : 'Banner Oculto'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  value={config.bannerType || 'info'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bannerType: e.target.value }))}
                  className="rq-input px-2.5 py-1.5 text-xs"
                >
                  <option value="info">Informativo (Azul)</option>
                  <option value="warning">Alerta / Desvíos (Amarillo)</option>
                  <option value="carnaval">Aviso Urgente (Rojo)</option>
                </select>
                <input
                  type="text"
                  maxLength={220}
                  placeholder="Mensaje en vivo (ej. Desvíos en Vía 40 por obras hoy hasta las 6 PM)"
                  value={config.bannerText || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bannerText: e.target.value }))}
                  className="rq-input px-2.5 py-1.5 text-xs sm:col-span-3"
                />
              </div>
            </div>

            {/* Dominios adicionales bloqueados */}
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Lista personalizada de dominios bloqueados ({config.blockedEmailDomains?.length || 0})
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Se suma a los +90 dominios desechables y typos bloqueados automáticamente
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar dominio a bloquear (ej. mailspamer.com)"
                  value={newBlockedDomain}
                  onChange={(e) => setNewBlockedDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBlockedDomain();
                    }
                  }}
                  className="rq-input flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddBlockedDomain}
                  className="rq-chip"
                  style={{ padding: '6px 10px', fontSize: 11, color: 'var(--brand)' }}
                >
                  <Plus size={12} /> Añadir
                </button>
              </div>
              {config.blockedEmailDomains?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {config.blockedEmailDomains.map((dom) => (
                    <span
                      key={dom}
                      className="font-mono text-[10.5px] px-2 py-0.5 rounded inline-flex items-center gap-1"
                      style={{ background: 'var(--carnaval-soft)', color: 'var(--carnaval)' }}
                    >
                      @{dom}
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedDomain(dom)}
                        className="bg-transparent border-0 p-0 cursor-pointer inline-flex"
                        style={{ color: 'inherit' }}
                        aria-label={`Quitar ${dom}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Postura de Seguridad & Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rq-card p-3.5 md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} color="var(--mangle)" />
              <span className="font-display text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Controles de arquitectura activos
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded" style={{ background: 'var(--mangle-soft)', color: 'var(--mangle)' }}>
              {health?.environment || 'prod'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {securityChecks.map((chk) => (
              <div
                key={chk.label}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {chk.ok ? (
                  <ShieldCheck size={14} color="var(--mangle)" className="flex-shrink-0" />
                ) : (
                  <ShieldAlert size={14} color="var(--brand)" className="flex-shrink-0" />
                )}
                <span className="truncate">{chk.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rq-card p-3.5 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock size={14} color="var(--brand)" />
              <span className="font-display text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Acciones de respuesta rápida
              </span>
            </div>

            <div className="space-y-1 text-xs mb-2.5">
              <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cuentas bloqueadas (15m)</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: sec.lockedAccounts > 0 ? 'var(--carnaval)' : 'var(--text-primary)' }}>
                  {sec.lockedAccounts ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cuentas suspendidas</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: sec.suspendedAccounts > 0 ? 'var(--brand)' : 'var(--text-primary)' }}>
                  {sec.suspendedAccounts ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: 'var(--text-secondary)' }}>Administradores activos</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--caribe)' }}>
                  {sec.totalAdmins ?? 1}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {confirmAction ? (
              <div className="p-2 rounded-lg space-y-2" style={{ background: 'var(--carnaval-soft)', border: '1px solid var(--carnaval)' }}>
                <p className="text-[11px] font-bold m-0" style={{ color: 'var(--carnaval)' }}>
                  {confirmAction === 'purge'
                    ? `¿Eliminar ${purgePreviewCount ?? 0} cuenta(s) sin verificar >7d con 0 aportes?`
                    : confirmAction === 'revoke'
                    ? '¿Cerrar todas las sesiones JWT de usuarios ahora?'
                    : '¿Desbloquear todas las cuentas bloqueadas por intentos fallidos?'}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={runningAction}
                    onClick={() => handleExecuteAction(confirmAction)}
                    className="flex-1 py-1.5 rounded text-[11px] font-bold cursor-pointer"
                    style={{ background: 'var(--carnaval)', color: '#FFFFFF', border: 'none' }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmAction(null); setPurgePreviewCount(null); }}
                    className="rq-chip flex-1 justify-center"
                    style={{ padding: '4px 0', fontSize: 11 }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePreparePurge}
                  disabled={runningAction}
                  className="rq-btn-ghost w-full text-[11.5px]"
                  style={{ padding: '6px 10px' }}
                >
                  <UserX size={12} color="var(--brand)" />
                  <span>Purgar no verificados (+7d)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('unlock')}
                  className="rq-btn-ghost w-full text-[11.5px]"
                  style={{ padding: '6px 10px' }}
                >
                  <Unlock size={12} color="var(--mangle)" />
                  <span>Desbloquear cuentas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('revoke')}
                  className="rq-btn-ghost w-full text-[11.5px]"
                  style={{ padding: '6px 10px', color: 'var(--carnaval)' }}
                >
                  <LogOut size={12} />
                  <span>Revocar sesiones globales</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearing}
              className="rq-btn-ghost w-full text-[11.5px]"
              style={{ padding: '6px 10px' }}
            >
              <Trash2 size={12} color="var(--brand)" />
              <span>{clearing ? 'Vaciando...' : 'Vaciar cachés de mapas'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visor de Bitácora de Auditoría */}
      <div className="rq-card p-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Shield size={15} color="var(--brand)" />
            <span className="font-display text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Registro de Auditoría ({totalLogs})
            </span>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="rq-chip"
            style={{ padding: '4px 9px', fontSize: 11 }}
          >
            <RefreshCw size={11} />
            <span>Refrescar</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setCategory(key);
                setPage(1);
              }}
              className={`rq-chip${category === key ? ' active' : ''}`}
              style={{ padding: '4px 9px', fontSize: 11 }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" color="var(--brand)" />
            <span>Cargando bitácora...</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-xs m-0" style={{ color: 'var(--text-muted)' }}>
            Sin registros en esta categoría. Las acciones administrativas quedarán grabadas aquí por 90 días.
          </p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const cat = CATEGORY_META[log.category] || CATEGORY_META.system;
              return (
                <div
                  key={log._id}
                  className="p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderLeft: `3px solid ${cat.color}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: `color-mix(in srgb, ${cat.color} 15%, transparent)`,
                          color: cat.color,
                        }}
                      >
                        {log.action}
                      </span>
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {log.summary}
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span>{log.adminEmail || 'system'}</span>
                      {log.ip && <span>· IP {log.ip}</span>}
                    </div>
                  </div>
                  <div className="font-mono text-[10.5px] flex-shrink-0 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(log.createdAt).toLocaleString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rq-icon-btn"
              style={{ width: 30, height: 30, opacity: page <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              Página {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rq-icon-btn"
              style={{ width: 30, height: 30, opacity: page >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
