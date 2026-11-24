/**
 * ============================================
 * RutaQuilla - Modal de Login/Registro v3
 * ============================================
 * Diseño premium: glassmorphism + gradientes + animaciones
 * - Soporta prop `reason` para mostrar mensajes contextuales
 * - Checkbox obligatorio de aceptación legal en registro
 * - Sin cuentas demo (producción real)
 */

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Loader2,
  CheckSquare,
  Square,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usersAPI } from '../services/api';

function FloatingInput({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  const isActive = focused || hasValue;

  return (
    <div className="relative" style={{ marginBottom: '6px' }}>
      <div
        className="relative flex items-center rounded-xl transition-all duration-200"
        style={{
          background: focused ? 'var(--bg-card)' : 'var(--bg-surface)',
          border: `1.5px solid ${focused ? 'var(--brand)' : 'var(--border-color)'}`,
        }}
      >
        {Icon && (
          <div className="absolute left-3.5" style={{ color: focused ? 'var(--brand)' : 'var(--text-muted)', transition: 'color 0.15s' }}>
            <Icon size={16} />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          className="w-full bg-transparent outline-none rq-plain-input"
          style={{
            padding: '20px 14px 8px 42px',
            paddingRight: rightElement ? '46px' : '14px',
            fontSize: '13.5px',
            color: 'var(--text-primary)',
          }}
          placeholder=" "
        />
        {/* Floating label */}
        <label
          htmlFor={id}
          style={{
            position: 'absolute',
            left: '42px',
            top: isActive ? '7px' : '50%',
            transform: isActive ? 'none' : 'translateY(-50%)',
            fontSize: isActive ? '10px' : '13.5px',
            color: isActive ? (focused ? 'var(--brand)' : 'var(--text-secondary)') : 'var(--text-muted)',
            transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
            fontWeight: isActive ? '600' : '400',
            letterSpacing: isActive ? '0.04em' : 'normal',
            textTransform: isActive ? 'uppercase' : 'none',
          }}
        >
          {label}
        </label>
        {rightElement && (
          <div className="absolute right-3">{rightElement}</div>
        )}
      </div>
    </div>
  );
}

const REASON_MESSAGES = {
  limit: {
    icon: Lock,
    title: 'Has usado tus 3 búsquedas gratis',
    subtitle: 'Regístrate para obtener búsquedas ilimitadas — es gratis.',
  },
  default: {
    icon: null,
    title: null,
    subtitle: null,
  },
};

export default function LoginModal({ isOpen, onClose, reason = null, onShowLegal }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Verification step
  const [verifyStep, setVerifyStep] = useState(false);
  const [verifyEmail, setVerifyEmailAddr] = useState('');
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Password reset steps
  const [forgotStep, setForgotStep] = useState(false);
  const [resetStep, setResetStep] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { login, register, verifyEmail: verifyEmailFn, resendCode: resendCodeFn, error: authError } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) {
      setEmail(''); setPassword(''); setName('');
      setLocalError(''); setMode('login');
      setAcceptedTerms(false);
      setVerifyStep(false); setVerifyEmailAddr('');
      setVerifyCode(['', '', '', '', '', '']);
      setForgotStep(false); setResetStep(false);
      setResetEmail(''); setResetCode(''); setNewPassword('');
      setShowNewPassword(false);
    }
    if (isOpen && reason === 'limit') {
      setMode('register');
    }
  }, [isOpen, reason]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const reasonData = REASON_MESSAGES[reason] || REASON_MESSAGES.default;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'register') {
      if (!name.trim()) {
        setLocalError('El nombre es requerido');
        return;
      }
      if (password.length < 8) {
        setLocalError('La contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (!acceptedTerms) {
        setLocalError('Debes aceptar la Política de Privacidad y los Términos');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password);
        // If NOT_VERIFIED, show verify step
        if (result?.notVerified) {
          setVerifyEmailAddr(result.email || email);
          setVerifyStep(true);
          setResendCooldown(60);
          setIsSubmitting(false);
          return;
        }
        onClose();
      } else {
        const result = await register(name, email, password);
        // If requires verification, show verify step
        if (result?.data?.requiresVerification) {
          setVerifyEmailAddr(result.data.email || email);
          setVerifyStep(true);
          setResendCooldown(60);
          setIsSubmitting(false);
          return;
        }
        onClose();
      }
    } catch (err) {
      setLocalError(err.message || 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setLocalError('Ingresa tu correo electrónico');
      return;
    }
    setResetLoading(true);
    try {
      await usersAPI.forgotPassword(targetEmail);
      setResetEmail(targetEmail);
      setForgotStep(false);
      setResetStep(true);
      toast.info('Si el correo está registrado, enviamos un código de recuperación');
    } catch (err) {
      setLocalError(err.message || 'No se pudo enviar el código de recuperación');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    const cleanCode = resetCode.trim();
    if (cleanCode.length !== 6) {
      setLocalError('Ingresa el código de 6 dígitos enviado a tu correo');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setResetLoading(true);
    try {
      await usersAPI.resetPassword(resetEmail, cleanCode, newPassword);
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      setResetStep(false);
      setForgotStep(false);
      setResetCode('');
      setNewPassword('');
      setEmail(resetEmail);
      setMode('login');
    } catch (err) {
      setLocalError(err.message || 'No se pudo restablecer la contraseña');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newCode = [...verifyCode];
    newCode[index] = value.slice(-1); // Only last digit
    setVerifyCode(newCode);
    // Auto-focus next input
    if (value && index < 5) {
      codeRefs[index + 1].current?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      codeRefs[index - 1].current?.focus();
    }
  };

  const handleCodePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setVerifyCode(pasted.split(''));
      codeRefs[5].current?.focus();
    }
  };

  const handleVerifySubmit = async () => {
    const code = verifyCode.join('');
    if (code.length !== 6) {
      setLocalError('Ingresa los 6 dígitos del código');
      return;
    }
    setVerifyLoading(true); setLocalError('');
    try {
      await verifyEmailFn(verifyEmail, code);
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Código incorrecto');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendCodeFn(verifyEmail);
      setResendCooldown(60);
      setLocalError('');
    } catch (err) {
      setLocalError(err.message || 'Error al reenviar');
    }
  };

  const errorMsg = localError || authError;

  const ReasonIcon = reasonData.icon;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={reason === 'limit' ? undefined : onClose}
        style={{
          background: 'rgba(13, 16, 20, 0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full animate-slide-up rq-card"
        style={{
          maxWidth: 420,
          maxHeight: 'calc(100dvh - 24px)',
          overflowY: 'auto',
          borderRadius: 18,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Close button (hidden when limit-gated) */}
        {reason !== 'limit' && (
          <button
            type="button"
            onClick={onClose}
            id="close-modal-btn"
            className="rq-icon-btn"
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10,
              width: 32, height: 32,
            }}
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        )}

        {/* Reason banner (when limit reached) */}
        {reasonData.title && !forgotStep && !resetStep && !verifyStep && (
          <div
            className="px-5 py-4 sm:px-7"
            style={{
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-color)',
              textAlign: 'center',
            }}
          >
            {ReasonIcon && (
              <div style={{
                width: 36, height: 36, borderRadius: 10, margin: '0 auto 8px',
                background: 'rgba(255, 194, 26, 0.14)',
                border: '1px solid rgba(255, 194, 26, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand)',
              }}>
                <ReasonIcon size={17} />
              </div>
            )}
            <p className="font-display" style={{
              fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 3px',
            }}>
              {reasonData.title}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {reasonData.subtitle}
            </p>
          </div>
        )}

        {/* Hero section */}
        <div
          className={`text-center px-5 sm:px-7 ${
            reasonData.title && !forgotStep && !resetStep && !verifyStep ? 'pt-4 pb-3' : 'pt-6 pb-4 sm:pt-7'
          }`}
        >
          {/* Brand or reset mark */}
          {(!reasonData.title || forgotStep || resetStep || verifyStep) && (
            forgotStep || resetStep ? (
              <div style={{
                width: 48, height: 48, borderRadius: 12, margin: '0 auto 14px',
                background: 'var(--plate-bg)',
                border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--plate-fg)',
              }}>
                <KeyRound size={22} strokeWidth={2.2} />
              </div>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 auto 14px',
              }}>
                <img
                  src="/logo.png"
                  alt="RutaQuilla"
                  style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8 }}
                />
                <span className="font-display" style={{
                  fontSize: 19, fontWeight: 800, color: 'var(--text-primary)',
                  letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  Ruta
                  <span style={{
                    background: 'var(--plate-bg)',
                    color: 'var(--plate-fg)',
                    padding: '1px 7px',
                    borderRadius: 6,
                    fontSize: 16,
                  }}>
                    Quilla
                  </span>
                </span>
              </div>
            )
          )}

          <h2 className="font-display" style={{
            fontSize: reasonData.title ? 20 : 22, fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            {verifyStep
              ? 'Verifica tu email'
              : forgotStep
                ? 'Recupera tu contraseña'
                : resetStep
                  ? 'Nueva contraseña'
                  : (mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta')}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
            {verifyStep
              ? <span>Enviamos un código a <strong style={{ color: 'var(--caribe)' }}>{verifyEmail}</strong></span>
              : forgotStep
                ? 'Te enviaremos un código de 6 dígitos para restablecer tu acceso'
                : resetStep
                  ? <span>Ingresa el código enviado a <strong style={{ color: 'var(--caribe)' }}>{resetEmail}</strong></span>
                  : (mode === 'login'
                    ? 'Planifica y guarda tus rutas en Barranquilla'
                    : 'Únete para búsquedas ilimitadas y reportes en vivo')
            }
          </p>
        </div>

        {/* === VERIFICATION STEP === */}
        {verifyStep ? (
          <div className="px-5 pb-6 sm:px-7 sm:pb-7">
            {/* Code input boxes */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 6,
              marginBottom: 18,
            }}>
              {verifyCode.map((digit, i) => (
                <input
                  key={i}
                  ref={codeRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  onPaste={i === 0 ? handleCodePaste : undefined}
                  autoFocus={i === 0}
                  className="font-mono tabular-nums"
                  style={{
                    flex: '1 1 0', maxWidth: 44, minWidth: 0, height: 48, borderRadius: 10,
                    background: digit ? 'var(--bg-card)' : 'var(--bg-surface)',
                    border: `1.5px solid ${digit ? 'var(--brand)' : 'var(--border-color)'}`,
                    color: 'var(--text-primary)', fontSize: 20, fontWeight: 700,
                    textAlign: 'center', outline: 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                    caretColor: 'var(--brand)',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--brand)'; }}
                  onBlur={e => { e.target.style.borderColor = digit ? 'var(--brand)' : 'var(--border-color)'; }}
                />
              ))}
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 14,
                background: 'rgba(229, 72, 77, 0.1)',
                border: '1px solid rgba(229, 72, 77, 0.28)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Shield size={14} style={{ color: 'var(--carnaval)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--carnaval)' }}>{errorMsg}</span>
              </div>
            )}

            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerifySubmit}
              disabled={verifyLoading || verifyCode.join('').length !== 6}
              className="rq-btn-primary"
              style={{
                width: '100%', padding: '12px',
                opacity: verifyCode.join('').length === 6 && !verifyLoading ? 1 : 0.45,
                cursor: verifyCode.join('').length === 6 && !verifyLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {verifyLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {verifyLoading ? 'Verificando...' : 'Verificar cuenta'}
            </button>

            {/* Resend code */}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                ¿No recibiste el código?
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--caribe)',
                  fontSize: 12.5, fontWeight: 600,
                }}
              >
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </div>
        ) : forgotStep ? (
          /* === FORGOT PASSWORD STEP 1: EMAIL === */
          <form onSubmit={handleForgotSubmit} className="px-5 pb-6 sm:px-7 sm:pb-7">
            <FloatingInput
              id="forgot-email-input"
              label="Correo electrónico"
              type="email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              icon={Mail}
              autoFocus
            />

            {errorMsg && (
              <div className="animate-fade-in" style={{
                marginTop: 12, padding: '10px 12px',
                background: 'rgba(229, 72, 77, 0.1)',
                border: '1px solid rgba(229, 72, 77, 0.28)',
                borderRadius: 10, fontSize: 12, color: 'var(--carnaval)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="rq-btn-primary"
              style={{
                width: '100%', marginTop: 16, padding: '12px 0',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {resetLoading ? 'Enviando...' : 'Enviar código de recuperación'}
            </button>

            <button
              type="button"
              onClick={() => { setForgotStep(false); setLocalError(''); }}
              style={{
                width: '100%', marginTop: 10, padding: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={14} /> Volver a iniciar sesión
            </button>
          </form>
        ) : resetStep ? (
          /* === FORGOT PASSWORD STEP 2: CODE + NEW PASSWORD === */
          <form onSubmit={handleResetSubmit} className="px-5 pb-6 sm:px-7 sm:pb-7">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FloatingInput
                id="reset-code-input"
                label="Código de 6 dígitos"
                type="text"
                value={resetCode}
                onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                icon={Shield}
                autoFocus
              />

              <FloatingInput
                id="reset-password-input"
                label="Nueva contraseña (mín. 8 caracteres)"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                icon={Lock}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </div>

            {errorMsg && (
              <div className="animate-fade-in" style={{
                marginTop: 12, padding: '10px 12px',
                background: 'rgba(229, 72, 77, 0.1)',
                border: '1px solid rgba(229, 72, 77, 0.28)',
                borderRadius: 10, fontSize: 12, color: 'var(--carnaval)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="rq-btn-primary"
              style={{
                width: '100%', marginTop: 16, padding: '12px 0',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {resetLoading ? 'Actualizando...' : 'Guardar nueva contraseña'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => { setResetStep(false); setForgotStep(true); setLocalError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                }}
              >
                Cambiar correo
              </button>
              <button
                type="button"
                onClick={() => { setResetStep(false); setForgotStep(false); setLocalError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--caribe)', fontSize: 12, fontWeight: 600,
                }}
              >
                Iniciar sesión
              </button>
            </div>
          </form>
        ) : (
        <>
        {/* Mode toggle pills */}
        <div className="px-5 pb-4 sm:px-7">
          <div style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            borderRadius: 10, padding: 3,
            border: '1px solid var(--border-color)',
          }}>
            {[
              { id: 'login', label: 'Iniciar sesión' },
              { id: 'register', label: 'Registrarse' },
            ].map(m => (
              <button
                type="button"
                key={m.id}
                onClick={() => { setMode(m.id); setLocalError(''); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7,
                  fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: mode === m.id ? 'var(--plate-bg)' : 'transparent',
                  color: mode === m.id ? 'var(--plate-fg)' : 'var(--text-muted)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-6 sm:px-7">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'register' && (
              <FloatingInput
                id="register-name-input"
                label="Nombre completo"
                value={name}
                onChange={e => setName(e.target.value)}
                icon={User}
                autoFocus
              />
            )}

            <FloatingInput
              id="email-input"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={Mail}
              autoFocus={mode === 'login'}
            />

            <FloatingInput
              id="password-input"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={Lock}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          {/* Password hint / Forgot password link */}
          {mode === 'register' ? (
            <p style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: password.length >= 8 ? 'var(--mangle)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 0.2s',
            }}>
              {password.length >= 8 ? <><Check size={12} /> Contraseña válida (mínimo 8 caracteres)</> : 'Mínimo 8 caracteres'}
            </p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setResetEmail(email); setLocalError(''); setForgotStep(true); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11.5, color: 'var(--caribe)', fontWeight: 600,
                  padding: '2px 0',
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {/* Legal checkbox (only for register) */}
          {mode === 'register' && (
            <div
              style={{
                marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: 'pointer',
              }}
              onClick={() => setAcceptedTerms(!acceptedTerms)}
            >
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                {acceptedTerms ? (
                  <CheckSquare size={18} color="var(--brand)" />
                ) : (
                  <Square size={18} color="var(--text-muted)" />
                )}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                Acepto la{' '}
                <span
                  style={{ color: 'var(--caribe)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); onShowLegal?.('privacy'); }}
                >
                  Política de Privacidad
                </span>{' '}
                y los{' '}
                <span
                  style={{ color: 'var(--caribe)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); onShowLegal?.('terms'); }}
                >
                  Términos y Condiciones
                </span>{' '}
                de RutaQuilla conforme a la Ley 1581 de 2012.
              </p>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="animate-fade-in" style={{
              marginTop: 12, padding: '10px 12px',
              background: 'rgba(229, 72, 77, 0.1)',
              border: '1px solid rgba(229, 72, 77, 0.28)',
              borderRadius: 10, fontSize: 12, color: 'var(--carnaval)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || (mode === 'register' && !acceptedTerms)}
            id="submit-auth-btn"
            className="rq-btn-primary"
            style={{
              width: '100%', marginTop: 18, padding: '13px 0',
              fontSize: 13.5,
              opacity: (isSubmitting || (mode === 'register' && !acceptedTerms)) ? 0.45 : 1,
              cursor: (isSubmitting || (mode === 'register' && !acceptedTerms)) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
              : <>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <ArrowRight size={16} /></>
            }
          </button>

          {/* Footer with legal links */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => onShowLegal?.('privacy')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Shield size={11} /> Privacidad
              </button>
              <button
                type="button"
                onClick={() => onShowLegal?.('terms')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                Términos
              </button>
            </div>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
