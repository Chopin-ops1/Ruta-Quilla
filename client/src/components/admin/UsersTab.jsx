import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  Crown,
  CheckCircle2,
  Search,
  Ban,
  RotateCcw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserCheck,
  AlertTriangle,
  Mail,
  Trash2,
  ShieldCheck,
  Send,
  GraduationCap,
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ROLE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'suspicious', label: 'Alertas / Typos' },
  { id: 'unverified', label: 'Sin verificar' },
  { id: 'verified', label: 'Verificados' },
  { id: 'premium', label: 'Quilla-Pass' },
  { id: 'free', label: 'Free' },
  { id: 'suspended', label: 'Suspendidos' },
  { id: 'admin', label: 'Admin' },
];

const SEVERITY_STYLE = {
  ok: { bg: 'var(--mangle-soft)', color: 'var(--mangle)' },
  info: { bg: 'var(--caribe-soft)', color: 'var(--caribe)' },
  warning: { bg: 'var(--brand-soft)', color: 'var(--brand)' },
  danger: { bg: 'var(--carnaval-soft)', color: 'var(--carnaval)' },
};

export default function UsersTab({ refreshTick = 0 }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [showDomains, setShowDomains] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await adminAPI.getUsersAudit();
      setAudit(res.data || null);
    } catch (e) {
      console.error('Error cargando auditoría de usuarios:', e);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({
        search: debouncedSearch,
        role: roleFilter,
        page,
        limit: 25,
      });
      setUsers(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, page, toast]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit, refreshTick]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshTick]);

  const handleAction = async (userId, payload, successMsg) => {
    setBusyId(userId);
    try {
      await adminAPI.updateUser(userId, payload);
      toast.success(successMsg);
      setSuspendTarget(null);
      setSuspendReason('');
      loadUsers();
      loadAudit();
    } catch (err) {
      toast.error(err.message || 'Error actualizando usuario');
    } finally {
      setBusyId(null);
    }
  };

  const handleResendOtp = async (u) => {
    setBusyId(u._id);
    try {
      const res = await adminAPI.resendUserVerification(u._id);
      toast.success(res.message || `OTP enviado a ${u.email}`);
    } catch (err) {
      toast.error(err.message || 'No se pudo enviar OTP por Zoho SMTP');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    setBusyId(u._id);
    try {
      await adminAPI.deleteUser(u._id);
      toast.success(`Cuenta ${u.email} eliminada`);
      setDeleteTargetId(null);
      loadUsers();
      loadAudit();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar cuenta');
    } finally {
      setBusyId(null);
    }
  };

  const sum = audit?.summary;
  const smtp = audit?.smtp;

  return (
    <div className="animate-fade-in p-3 sm:p-4 space-y-3.5 max-w-[1040px] mx-auto">
      {/* Diagnóstico de autenticidad de usuarios y DNS MX */}
      <div className="rq-card p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} color="var(--mangle)" />
            <div>
              <div className="font-display text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Auditoría de Autenticidad y Correos MX
              </div>
              <p className="text-[11px] m-0" style={{ color: 'var(--text-secondary)' }}>
                Verifica dominios DNS MX reales, errores tipográficos y cuentas sin confirmar OTP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {smtp && (
              <span
                className="font-mono text-[10px] font-bold px-2 py-1 rounded-md inline-flex items-center gap-1"
                style={{
                  background: smtp.connected ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
                  color: smtp.connected ? 'var(--mangle)' : 'var(--carnaval)',
                }}
                title={smtp.error || 'Zoho Mail conectado'}
              >
                <Mail size={11} />
                {smtp.connected ? 'Zoho SMTP OK' : smtp.configured ? 'SMTP Error' : 'SMTP Off'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowDomains((s) => !s)}
              className="rq-chip"
              style={{ padding: '4px 9px', fontSize: 10.5 }}
            >
              {showDomains ? 'Ocultar dominios' : `Ver dominios (${audit?.domains?.length || 0})`}
            </button>
          </div>
        </div>

        {loadingAudit && !sum ? (
          <div className="py-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={13} className="animate-spin" color="var(--brand)" />
            <span>Analizando registros DNS MX y cuentas...</span>
          </div>
        ) : sum ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>Personas verificadas</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-0.5" style={{ color: 'var(--mangle)' }}>
                  {sum.verifiedHumans}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {sum.institutionalCount} institucional (.edu.co)
                </div>
              </div>

              <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>Pendientes OTP</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-0.5" style={{ color: 'var(--caribe)' }}>
                  {sum.unverifiedTotal}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {sum.unverifiedRecent} recientes · {sum.unverifiedStale} (+7d)
                </div>
              </div>

              <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>Typos / Sin MX</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-0.5" style={{ color: sum.typoOrNoMxCount > 0 ? 'var(--carnaval)' : 'var(--text-primary)' }}>
                  {sum.typoOrNoMxCount}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  ej. @hotmai.con / @gmai.com
                </div>
              </div>

              <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>Alertas / Demo</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-0.5" style={{ color: sum.alertsTotal > 0 ? 'var(--brand)' : 'var(--text-primary)' }}>
                  {sum.alertsTotal}
                </div>
                {sum.alertsTotal > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('suspicious');
                      setPage(1);
                    }}
                    className="text-[10px] font-bold underline bg-transparent border-0 p-0 cursor-pointer"
                    style={{ color: 'var(--brand)' }}
                  >
                    Filtrar alertas ahora
                  </button>
                ) : (
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Todo limpio</div>
                )}
              </div>
            </div>

            {showDomains && audit?.domains?.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
                {audit.domains.map((d) => (
                  <span
                    key={d.domain}
                    className="font-mono text-[10px] px-2 py-1 rounded inline-flex items-center gap-1.5"
                    style={{
                      background: d.mxValid === false ? 'var(--carnaval-soft)' : 'var(--bg-surface)',
                      color: d.mxValid === false ? 'var(--carnaval)' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span>@{d.domain}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.count}</strong>
                    <span style={{ color: d.mxValid ? 'var(--mangle)' : d.mxValid === false ? 'var(--carnaval)' : 'var(--text-muted)' }}>
                      {d.mxValid ? 'MX' : d.mxValid === false ? 'SIN MX' : '?'}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Encabezado y buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="rq-section-label">Directorio de cuentas</div>
          <p className="font-display text-sm font-bold m-0 mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {total} {total === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full sm:w-72"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)', minWidth: 0 }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setRoleFilter(f.id);
              setPage(1);
            }}
            className={`rq-chip${roleFilter === f.id ? ' active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" color="var(--brand)" />
          <span>Cargando usuarios...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="rq-card py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          No hay usuarios con ese criterio.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isAdminAccount = u.role === 'admin';
            const isBusy = busyId === u._id;
            const auth = u.authenticity || {};
            const sev = SEVERITY_STYLE[auth.severity] || SEVERITY_STYLE.info;
            const roleColor = isAdminAccount
              ? 'var(--carnaval)'
              : u.role === 'premium'
              ? 'var(--brand)'
              : 'var(--text-secondary)';
            const roleBg = isAdminAccount
              ? 'var(--carnaval-soft)'
              : u.role === 'premium'
              ? 'var(--brand-soft)'
              : 'var(--bg-surface)';

            return (
              <div
                key={u._id}
                className="rq-card p-3 space-y-2.5"
                style={{
                  borderLeft: `3px solid ${
                    u.isSuspended
                      ? 'var(--carnaval)'
                      : auth.severity === 'danger'
                      ? 'var(--carnaval)'
                      : auth.severity === 'warning'
                      ? 'var(--brand)'
                      : roleColor
                  }`,
                }}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        flexShrink: 0,
                        background: roleBg,
                        color: roleColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {isAdminAccount ? (
                        <Shield size={15} />
                      ) : auth.classification === 'institutional' ? (
                        <GraduationCap size={15} color="var(--mangle)" />
                      ) : u.role === 'premium' ? (
                        <Crown size={15} />
                      ) : (
                        <Users size={15} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {u.name}
                        </span>
                        {u.isVerified && <CheckCircle2 size={12} color="var(--mangle)" title="Email verificado" />}
                        <span
                          className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                          style={{ background: roleBg, color: roleColor }}
                        >
                          {u.role}
                        </span>
                        {auth.label && (
                          <span
                            className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: sev.bg, color: sev.color }}
                          >
                            {auth.label}
                          </span>
                        )}
                        {u.isSuspended && (
                          <span
                            className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{ background: 'var(--carnaval-soft)', color: 'var(--carnaval)' }}
                          >
                            Suspendida
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] m-0 mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {u.email}
                      </p>
                      <div className="text-[10px] font-mono mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        <span>{u.contributions || 0} contrib.</span>
                        <span>· {u.xp || 0} XP</span>
                        <span>· {new Date(u.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {auth.mxStatus && <span>· {auth.mxStatus}</span>}
                      </div>

                      {Array.isArray(auth.flags) && auth.flags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {auth.flags.map((flag) => (
                            <span
                              key={flag}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: sev.bg, color: sev.color }}
                            >
                              <AlertTriangle size={10} />
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {u.isSuspended && u.suspendedReason && (
                  <p className="text-[11px] m-0 px-2 py-1 rounded" style={{ background: 'var(--carnaval-soft)', color: 'var(--carnaval)' }}>
                    Motivo suspensión: {u.suspendedReason}
                  </p>
                )}

                {!isAdminAccount && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(
                          u._id,
                          { role: u.role === 'premium' ? 'free' : 'premium' },
                          u.role === 'premium' ? 'Plan cambiado a Free' : 'Quilla-Pass otorgado'
                        )
                      }
                      className="rq-chip"
                      style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--brand)' }}
                    >
                      <Crown size={11} />
                      <span>{u.role === 'premium' ? 'Pasar a Free' : 'Dar Quilla-Pass'}</span>
                    </button>

                    {!u.isVerified && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleResendOtp(u)}
                          className="rq-chip"
                          style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--caribe)' }}
                        >
                          <Send size={11} />
                          <span>Reenviar OTP</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(u._id, { isVerified: true }, 'Email verificado manualmente')}
                          className="rq-chip"
                          style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--mangle)' }}
                        >
                          <UserCheck size={11} />
                          <span>Verificar manual</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(u._id, { revokeSessions: true }, 'Sesiones JWT revocadas')}
                      className="rq-chip"
                      style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--caribe)' }}
                    >
                      <LogOut size={11} />
                      <span>Cerrar sesiones</span>
                    </button>

                    {u.isSuspended ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(u._id, { isSuspended: false }, 'Cuenta reactivada')}
                        className="rq-chip"
                        style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--mangle)' }}
                      >
                        <RotateCcw size={11} />
                        <span>Reactivar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setSuspendTarget(suspendTarget === u._id ? null : u._id);
                          setSuspendReason('');
                        }}
                        className="rq-chip"
                        style={{ padding: '4px 9px', fontSize: 10.5, color: 'var(--carnaval)' }}
                      >
                        <Ban size={11} />
                        <span>Suspender</span>
                      </button>
                    )}

                    {deleteTargetId === u._id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteUser(u)}
                          className="rq-chip"
                          style={{
                            padding: '4px 9px',
                            fontSize: 10.5,
                            background: 'var(--carnaval)',
                            color: '#FFFFFF',
                            borderColor: 'var(--carnaval)',
                          }}
                        >
                          Confirmar borrado
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(null)}
                          className="rq-chip"
                          style={{ padding: '4px 8px', fontSize: 10.5 }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTargetId(u._id)}
                        className="rq-chip"
                        style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--carnaval)' }}
                        title="Eliminar cuenta"
                      >
                        <Trash2 size={11} />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                )}

                {suspendTarget === u._id && (
                  <div className="p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <input
                      type="text"
                      placeholder="Motivo de suspensión (opcional)"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="rq-input w-full px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleAction(
                            u._id,
                            { isSuspended: true, suspendedReason: suspendReason },
                            `Cuenta de ${u.name} suspendida`
                          )
                        }
                        className="flex-1 py-1.5 rounded-md font-bold text-xs cursor-pointer"
                        style={{ background: 'var(--carnaval)', color: '#FFFFFF', border: 'none' }}
                      >
                        Confirmar suspensión
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuspendTarget(null)}
                        className="rq-chip flex-1 justify-center"
                        style={{ padding: '6px 0' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
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
  );
}
