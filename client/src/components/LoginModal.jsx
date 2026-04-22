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
import { X, Mail, Lock, User, Eye, EyeOff, Bus, Shield, ArrowRight, Loader2, MapPin, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
            ? 'rgba(6, 182, 212, 0.06)'
            : 'rgba(255,255,255,0.03)',
          border: `1.5px solid ${focused ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: focused ? '0 0 0 4px rgba(6,182,212,0.08)' : 'none',
        }}
      >
        {Icon && (
          <div className="absolute left-4" style={{ color: focused ? '#06B6D4' : '#64748B', transition: 'color 0.2s' }}>
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
            color: '#F1F5F9',
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
            color: isActive ? (focused ? '#06B6D4' : '#94A3B8') : '#64748B',
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

  const { login, register, verifyEmail: verifyEmailFn, resendCode: resendCodeFn, error: authError } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setEmail(''); setPassword(''); setName('');
      setLocalError(''); setMode('login');
      setAcceptedTerms(false);
      setVerifyStep(false); setVerifyEmailAddr('');
      setVerifyCode(['', '', '', '', '', '']);
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

    if (mode === 'register' && !acceptedTerms) {
      setLocalError('Debes aceptar la Política de Privacidad y los Términos');
      return;
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
        if (!name.trim()) { setLocalError('El nombre es requerido'); setIsSubmitting(false); return; }
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
          background: 'linear-gradient(145deg, rgba(17,24,39,0.97) 0%, rgba(11,17,32,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
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
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94A3B8',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            <X size={15} />
          </button>
        )}

        {/* Reason banner (when limit reached) */}
        {reasonData.title && (
          <div style={{
            padding: '16px 36px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(6,182,212,0.08))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{reasonData.icon}</div>
            <p style={{
              fontSize: 14, fontWeight: 700, color: '#F59E0B',
              fontFamily: 'Outfit, sans-serif', margin: 0, marginBottom: 4,
            }}>
              {reasonData.title}
            </p>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
              {reasonData.subtitle}
            </p>
          </div>
        )}

        {/* Hero section */}
        <div style={{ padding: reasonData.title ? '20px 36px 16px' : '36px 36px 24px', textAlign: 'center' }}>
          {/* Logo */}
          {!reasonData.title && (
            <div style={{
              width: 68, height: 68, borderRadius: 20, margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #92400E 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(245,158,11,0.35), 0 0 0 1px rgba(245,158,11,0.2) inset',
            }}>
              <Bus size={32} color="#000" strokeWidth={2.5} />
            </div>
          )}

          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: reasonData.title ? 22 : 26, fontWeight: 700,
            color: '#F1F5F9', marginBottom: 6, lineHeight: 1.2,
          }}>
            {verifyStep ? 'Verifica tu email' : (mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta')}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
            {verifyStep
              ? <span>Enviamos un código a <strong style={{ color: '#06B6D4' }}>{verifyEmail}</strong></span>
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
                    background: digit ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${digit ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: '#F59E0B', fontSize: 24, fontWeight: 800,
                    textAlign: 'center', outline: 'none',
                    fontFamily: "'Courier New', monospace",
                    transition: 'all 0.2s',
                    caretColor: '#F59E0B',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.7)'; e.target.style.boxShadow = '0 0 0 4px rgba(6,182,212,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = digit ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
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
                <Shield size={14} style={{ color: '#F87171', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#F87171' }}>{errorMsg}</span>
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
                  : 'rgba(255,255,255,0.06)',
                color: verifyCode.join('').length === 6 ? '#000' : '#475569',
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
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px' }}>
                ¿No recibiste el código?
              </p>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  color: resendCooldown > 0 ? '#334155' : '#06B6D4',
                  fontSize: 13, fontWeight: 600,
                  transition: 'color 0.2s',
                }}
              >
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Mode toggle pills */}
        <div style={{ padding: '0 36px 24px' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 14, padding: 4,
            border: '1px solid rgba(255,255,255,0.07)',
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
                  color: mode === m.id ? '#000' : '#64748B',
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
                  style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          {/* Legal checkbox (only for register) */}
          {mode === 'register' && (
            <div
              style={{
                marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: 'pointer',
              }}
              onClick={() => setAcceptedTerms(!acceptedTerms)}
            >
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                {acceptedTerms ? (
                  <CheckSquare size={18} color="#F59E0B" />
                ) : (
                  <Square size={18} color="#475569" />
                )}
              </div>
              <p style={{ fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                Acepto la{' '}
                <span
                  style={{ color: '#06B6D4', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); onShowLegal?.('privacy'); }}
                >
                  Política de Privacidad
                </span>{' '}
                y los{' '}
                <span
                  style={{ color: '#06B6D4', cursor: 'pointer', textDecoration: 'underline' }}
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
              borderRadius: 12, fontSize: 12, color: '#FCA5A5',
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
              color: (isSubmitting || (mode === 'register' && !acceptedTerms)) ? '#666' : '#000',
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
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => onShowLegal?.('privacy')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#475569', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#06B6D4'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
              >
                <Shield size={11} /> Privacidad
              </button>
              <button
                type="button"
                onClick={() => onShowLegal?.('terms')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#475569', fontWeight: 500,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#06B6D4'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
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
