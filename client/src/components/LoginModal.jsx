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
import { X, Mail, Lock, User, Eye, EyeOff, Bus, Shield, ArrowRight, ArrowLeft, KeyRound, Loader2, CheckSquare, Square } from 'lucide-react';
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
        className="relative flex items-center rounded-2xl transition-all duration-300"
        style={{
          background: focused
            ? 'rgba(6, 182, 212, 0.08)'
            : 'var(--subtle-bg)',
          border: `1.5px solid ${focused ? 'var(--accent-cyan)' : 'var(--subtle-border-strong)'}`,
          boxShadow: focused ? '0 0 0 4px rgba(6,182,212,0.08)' : 'none',
        }}
      >
        {Icon && (
          <div className="absolute left-4" style={{ color: focused ? 'var(--accent-cyan)' : 'var(--text-muted)', transition: 'color 0.2s' }}>
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
          className="w-full bg-transparent outline-none"
          style={{
            padding: '20px 16px 8px 44px',
            paddingRight: rightElement ? '48px' : '16px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif',
          }}
          placeholder=" "
        />
        {/* Floating label */}
        <label
          htmlFor={id}
          style={{
            position: 'absolute',
            left: '44px',
            top: isActive ? '8px' : '50%',
            transform: isActive ? 'none' : 'translateY(-50%)',
            fontSize: isActive ? '10px' : '14px',
            color: isActive ? (focused ? 'var(--accent-cyan)' : 'var(--text-secondary)') : 'var(--text-muted)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
            fontWeight: isActive ? '600' : '400',
            letterSpacing: isActive ? '0.05em' : 'normal',
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
    icon: '🔒',
    title: 'Has usado tus 3 búsquedas gratis',
    subtitle: 'Regístrate para obtener búsquedas ilimitadas — ¡es gratis!',
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

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Animated backdrop */}
      <div
        className="absolute inset-0"
        onClick={reason === 'limit' ? undefined : onClose}
        style={{
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      />

      {/* Glow orbs in background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
          top: '10%', left: '20%',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          bottom: '10%', right: '15%',
          filter: 'blur(80px)',
        }} />
      </div>

      {/* Modal */}
      <div
        className="relative w-full animate-slide-up"
        style={{
          maxWidth: 440,
          borderRadius: 28,
          background: 'var(--panel-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--subtle-border-strong)',
          boxShadow: '0 40px 80px var(--shadow-color), 0 0 0 1px var(--subtle-border) inset',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient bar */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, #F59E0B, #06B6D4, #8B5CF6)',
        }} />

        {/* Close button (hidden when limit-gated) */}
        {reason !== 'limit' && (
          <button
            onClick={onClose}
            id="close-modal-btn"
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--subtle-bg)',
              border: '1px solid var(--subtle-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle-bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--subtle-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <X size={15} />
          </button>
        )}

        {/* Reason banner (when limit reached) */}
        {reasonData.title && !forgotStep && !resetStep && !verifyStep && (
          <div style={{
            padding: '16px 36px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(6,182,212,0.08))',
            borderBottom: '1px solid var(--subtle-border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{reasonData.icon}</div>
            <p style={{
              fontSize: 14, fontWeight: 700, color: '#F59E0B',
              fontFamily: 'Outfit, sans-serif', margin: 0, marginBottom: 4,
            }}>
              {reasonData.title}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {reasonData.subtitle}
            </p>
          </div>
        )}

        {/* Hero section */}
        <div style={{ padding: reasonData.title && !forgotStep && !resetStep && !verifyStep ? '20px 36px 16px' : '36px 36px 24px', textAlign: 'center' }}>
          {/* Logo */}
          {(!reasonData.title || forgotStep || resetStep || verifyStep) && (
            <div style={{
              width: 68, height: 68, borderRadius: 20, margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #92400E 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(245,158,11,0.35), 0 0 0 1px rgba(245,158,11,0.2) inset',
            }}>
              {forgotStep || resetStep ? (
                <KeyRound size={30} color="#000" strokeWidth={2.4} />
              ) : (
                <Bus size={32} color="#000" strokeWidth={2.5} />
              )}
            </div>
          )}

          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: reasonData.title ? 22 : 26, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.2,
          }}>
            {verifyStep
              ? 'Verifica tu email'
              : forgotStep
                ? 'Recupera tu contraseña'
                : resetStep
                  ? 'Nueva contraseña'
                  : (mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {verifyStep
              ? <span>Enviamos un código a <strong style={{ color: 'var(--accent-cyan)' }}>{verifyEmail}</strong></span>
              : forgotStep
                ? 'Te enviaremos un código de 6 dígitos para restablecer tu acceso'
                : resetStep
                  ? <span>Ingresa el código enviado a <strong style={{ color: 'var(--accent-cyan)' }}>{resetEmail}</strong></span>
                  : (mode === 'login'
                    ? 'Conecta con el transporte de Barranquilla'
                    : 'Únete a la comunidad de transporte colectivo')
            }
          </p>
        </div>

        {/* === VERIFICATION STEP === */}
        {verifyStep ? (
          <div style={{ padding: '0 36px 32px' }}>
            {/* Code input boxes */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 8,
              marginBottom: 20,
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
                  style={{
                    width: 48, height: 56, borderRadius: 14,
                    background: digit ? 'rgba(245,158,11,0.1)' : 'var(--subtle-bg)',
                    border: `2px solid ${digit ? 'rgba(245,158,11,0.5)' : 'var(--subtle-border-strong)'}`,
                    color: '#F59E0B', fontSize: 24, fontWeight: 800,
                    textAlign: 'center', outline: 'none',
                    fontFamily: "'Courier New', monospace",
                    transition: 'all 0.2s',
                    caretColor: '#F59E0B',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-cyan)'; e.target.style.boxShadow = '0 0 0 4px rgba(6,182,212,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = digit ? 'rgba(245,158,11,0.5)' : 'var(--subtle-border-strong)'; e.target.style.boxShadow = 'none'; }}
                />
              ))}
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 12, marginBottom: 14,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Shield size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#EF4444' }}>{errorMsg}</span>
              </div>
            )}

            {/* Verify button */}
            <button
              onClick={handleVerifySubmit}
              disabled={verifyLoading || verifyCode.join('').length !== 6}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                background: verifyCode.join('').length === 6
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'var(--subtle-bg)',
                color: verifyCode.join('').length === 6 ? '#000' : 'var(--text-muted)',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: verifyCode.join('').length === 6 ? '0 6px 20px rgba(245,158,11,0.35)' : 'none',
                transition: 'all 0.3s',
              }}
            >
              {verifyLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {verifyLoading ? 'Verificando...' : 'Verificar cuenta'}
            </button>

            {/* Resend code */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                ¿No recibiste el código?
              </p>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-cyan)',
                  fontSize: 13, fontWeight: 600,
                  transition: 'color 0.2s',
                }}
              >
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </div>
        ) : forgotStep ? (
          /* === FORGOT PASSWORD STEP 1: EMAIL === */
          <form onSubmit={handleForgotSubmit} style={{ padding: '0 36px 32px' }}>
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
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 12, fontSize: 12, color: '#EF4444',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%', marginTop: 18, padding: '14px 0',
                borderRadius: 14, border: 'none',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#000', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
              }}
            >
              {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {resetLoading ? 'Enviando...' : 'Enviar código de recuperación'}
            </button>

            <button
              type="button"
              onClick={() => { setForgotStep(false); setLocalError(''); }}
              style={{
                width: '100%', marginTop: 12, padding: '10px',
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
          <form onSubmit={handleResetSubmit} style={{ padding: '0 36px 32px' }}>
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
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 12, fontSize: 12, color: '#EF4444',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%', marginTop: 18, padding: '14px 0',
                borderRadius: 14, border: 'none',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#000', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
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
                  color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600,
                }}
              >
                Iniciar sesión
              </button>
            </div>
          </form>
        ) : (
        <>
        {/* Mode toggle pills */}
        <div style={{ padding: '0 36px 24px' }}>
          <div style={{
            display: 'flex',
            background: 'var(--subtle-bg)',
            borderRadius: 14, padding: 4,
            border: '1px solid var(--subtle-border)',
          }}>
            {[
              { id: 'login', label: 'Iniciar sesión' },
              { id: 'register', label: 'Registrarse' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setLocalError(''); }}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  background: mode === m.id ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'transparent',
                  color: mode === m.id ? '#000' : 'var(--text-muted)',
                  boxShadow: mode === m.id ? '0 4px 12px rgba(245,158,11,0.3)' : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '0 36px 28px' }}>
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
              margin: '4px 0 0',
              fontSize: 11,
              color: password.length >= 8 ? '#10B981' : 'var(--text-muted)',
              transition: 'color 0.2s',
            }}>
              {password.length >= 8 ? '✓ Contraseña válida (mínimo 8 caracteres)' : 'Mínimo 8 caracteres'}
            </p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setResetEmail(email); setLocalError(''); setForgotStep(true); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11.5, color: 'var(--accent-cyan)', fontWeight: 600,
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
                marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: 'pointer',
              }}
              onClick={() => setAcceptedTerms(!acceptedTerms)}
            >
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                {acceptedTerms ? (
                  <CheckSquare size={18} color="#F59E0B" />
                ) : (
                  <Square size={18} color="var(--text-muted)" />
                )}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Acepto la{' '}
                <span
                  style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); onShowLegal?.('privacy'); }}
                >
                  Política de Privacidad
                </span>{' '}
                y los{' '}
                <span
                  style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
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
              marginTop: 14, padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, fontSize: 12, color: '#EF4444',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || (mode === 'register' && !acceptedTerms)}
            id="submit-auth-btn"
            style={{
              width: '100%', marginTop: 20, padding: '15px 0',
              borderRadius: 16, border: 'none',
              cursor: (isSubmitting || (mode === 'register' && !acceptedTerms)) ? 'not-allowed' : 'pointer',
              background: (isSubmitting || (mode === 'register' && !acceptedTerms))
                ? 'rgba(245,158,11,0.25)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: (isSubmitting || (mode === 'register' && !acceptedTerms)) ? 'var(--text-muted)' : '#000',
              fontSize: 14, fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: (isSubmitting || (mode === 'register' && !acceptedTerms))
                ? 'none' : '0 8px 24px rgba(245,158,11,0.35)',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (!isSubmitting && (mode !== 'register' || acceptedTerms)) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(245,158,11,0.45)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = (isSubmitting || (mode === 'register' && !acceptedTerms)) ? 'none' : '0 8px 24px rgba(245,158,11,0.35)'; }}
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
              : <>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <ArrowRight size={16} /></>
            }
          </button>

          {/* Footer with legal links */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--subtle-border)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => onShowLegal?.('privacy')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-cyan)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Shield size={11} /> Privacidad
              </button>
              <button
                type="button"
                onClick={() => onShowLegal?.('terms')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-cyan)'; }}
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
