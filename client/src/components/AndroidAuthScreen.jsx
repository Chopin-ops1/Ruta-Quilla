/**
 * ============================================
 * RutaQuilla - Pantalla de Bienvenida / Login Nativo Android
 * ============================================
 *
 * Experiencia full-screen móvil al abrir la app Android:
 * - Cabecera editorial animada con trazado SVG sutil
 * - Acceso inmediato con correo/contraseña o creación de cuenta
 * - Verificación por código de 6 dígitos y recuperación de contraseña
 * - Sonido y vibración háptica sutiles al autenticarse
 */

import { useState, useRef, useEffect } from 'react';
import {
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
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usersAPI } from '../services/api';
import { fxTap, fxLoginSuccess } from '../utils/soundAndHaptics';

const COMMON_EMAIL_TYPOS = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmai.con': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com',
};

function getSuggestedEmail(rawEmail) {
  const trimmed = String(rawEmail || '').trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!COMMON_EMAIL_TYPOS[domain]) return null;
  return `${local}@${COMMON_EMAIL_TYPOS[domain]}`;
}

function MobileField({ id, label, type = 'text', value, onChange, icon: Icon, rightElement, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const hasValue = Boolean(value && value.length > 0);
  const isActive = focused || hasValue;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className="relative flex items-center rounded-xl transition-all duration-200"
        style={{
          background: focused ? 'var(--bg-card)' : 'var(--bg-surface)',
          border: `1.5px solid ${focused ? 'var(--brand)' : 'var(--border-color)'}`,
          boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--brand) 14%, transparent)' : 'none',
        }}
      >
        {Icon && (
          <div
            className="absolute left-3.5"
            style={{ color: focused ? 'var(--brand)' : 'var(--text-muted)', transition: 'color 0.15s' }}
          >
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
            padding: '21px 14px 8px 42px',
            paddingRight: rightElement ? '46px' : '14px',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
          placeholder=" "
        />
        <label
          htmlFor={id}
          style={{
            position: 'absolute',
            left: '42px',
            top: isActive ? '7px' : '50%',
            transform: isActive ? 'none' : 'translateY(-50%)',
            fontSize: isActive ? '10px' : '13.5px',
            color: isActive ? (focused ? 'var(--brand)' : 'var(--text-secondary)') : 'var(--text-muted)',
            transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: 'none',
            fontWeight: isActive ? '600' : '400',
            letterSpacing: isActive ? '0.04em' : 'normal',
            textTransform: isActive ? 'uppercase' : 'none',
          }}
        >
          {label}
        </label>
        {rightElement && <div className="absolute right-3">{rightElement}</div>}
      </div>
    </div>
  );
}

export default function AndroidAuthScreen({ onShowLegal }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Verificación OTP / 2FA
  const [verifyStep, setVerifyStep] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Recuperación de contraseña
  const [forgotStep, setForgotStep] = useState(false);
  const [resetStep, setResetStep] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Seguridad invisible + widget opcional
  const [honeypotWebsite] = useState('');
  const [formToken, setFormToken] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);

  const {
    login,
    register,
    verifyEmail: verifyEmailFn,
    verifyTwoFactor: verifyTwoFactorFn,
    resendCode: resendCodeFn,
    error: authError,
    publicConfig,
    refreshPublicConfig,
  } = useAuth();
  const toast = useToast();

  const emailSuggestion = mode === 'register' ? getSuggestedEmail(email) : null;
  const registrationDisabled = mode === 'register' && publicConfig?.registrationEnabled === false;

  useEffect(() => {
    refreshPublicConfig();
    usersAPI
      .getFormToken()
      .then((res) => {
        if (res?.formToken) setFormToken(res.formToken);
      })
      .catch(() => {
        if (publicConfig?.formToken) setFormToken(publicConfig.formToken);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      verifyStep ||
      forgotStep ||
      resetStep ||
      !publicConfig?.turnstileEnabled ||
      !publicConfig?.turnstileSiteKey
    ) {
      setTurnstileToken('');
      return;
    }

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !turnstileRef.current || !window.turnstile) return;
      try {
        if (turnstileWidgetIdRef.current !== null) {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        }
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: publicConfig.turnstileSiteKey,
          callback: (token) => setTurnstileToken(token || ''),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      } catch (_) {}
    };

    if (window.turnstile) {
      renderWidget();
    } else if (!document.getElementById('cf-turnstile-script')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      document.head.appendChild(s);
    }

    return () => {
      cancelled = true;
      try {
        if (window.turnstile && turnstileWidgetIdRef.current !== null) {
          window.turnstile.remove(turnstileWidgetIdRef.current);
          turnstileWidgetIdRef.current = null;
        }
      } catch (_) {}
    };
  }, [mode, verifyStep, forgotStep, resetStep, publicConfig?.turnstileEnabled, publicConfig?.turnstileSiteKey]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'register') {
      if (!name.trim()) {
        setLocalError('Ingresa tu nombre completo');
        return;
      }
      if (password.length < 8) {
        setLocalError('La contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (!acceptedTerms) {
        setLocalError('Acepta la Política de Privacidad y los Términos para continuar');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let currentFormToken = formToken || publicConfig?.formToken || '';
      if (mode === 'register' && !publicConfig?.turnstileEnabled && !currentFormToken) {
        try {
          const ftRes = await usersAPI.getFormToken();
          if (ftRes?.formToken) {
            currentFormToken = ftRes.formToken;
            setFormToken(ftRes.formToken);
          }
        } catch (_) {}
      }

      if (mode === 'login') {
        if (publicConfig?.turnstileEnabled && publicConfig?.turnstileSiteKey && !turnstileToken) {
          setLocalError('Completa la verificación de seguridad para continuar.');
          setIsSubmitting(false);
          return;
        }
        const result = await login(email, password, {
          website: honeypotWebsite,
          turnstileToken,
        });
        if (result?.requiresTwoFactor) {
          setTwoFactorStep(true);
          setVerifyEmailAddr(result.email || email);
          setVerifyCode(['', '', '', '', '', '']);
          setVerifyStep(true);
          setIsSubmitting(false);
          return;
        }
        if (result?.notVerified) {
          setTwoFactorStep(false);
          setVerifyEmailAddr(result.email || email);
          setVerifyStep(true);
          setResendCooldown(60);
          setIsSubmitting(false);
          return;
        }
        fxLoginSuccess();
      } else {
        if (registrationDisabled) {
          setLocalError('El registro de nuevas cuentas está pausado temporalmente.');
          setIsSubmitting(false);
          return;
        }
        if (publicConfig?.turnstileEnabled && publicConfig?.turnstileSiteKey && !turnstileToken) {
          setLocalError('Completa la verificación de seguridad antes de crear tu cuenta.');
          setIsSubmitting(false);
          return;
        }
        const result = await register(name, email, password, {
          website: honeypotWebsite,
          formToken: currentFormToken,
          turnstileToken,
        });
        if (result?.data?.requiresVerification) {
          setTwoFactorStep(false);
          setVerifyEmailAddr(result.data.email || email);
          setVerifyStep(true);
          setResendCooldown(60);
          setIsSubmitting(false);
          return;
        }
        fxLoginSuccess();
      }
    } catch (err) {
      setLocalError(err.message || 'No pudimos iniciar sesión. Verifica tus datos.');
      if (window.turnstile && turnstileWidgetIdRef.current !== null) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch (_) {}
        setTurnstileToken('');
      }
      usersAPI
        .getFormToken()
        .then((res) => {
          if (res?.formToken) setFormToken(res.formToken);
        })
        .catch(() => {});
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
    if (!/^\d*$/.test(value)) return;
    const next = [...verifyCode];
    next[index] = value.slice(-1);
    setVerifyCode(next);
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
    setVerifyLoading(true);
    setLocalError('');
    try {
      if (twoFactorStep) {
        await verifyTwoFactorFn(verifyEmailAddr, code);
      } else {
        await verifyEmailFn(verifyEmailAddr, code);
      }
      fxLoginSuccess();
    } catch (err) {
      setLocalError(err.message || 'Código incorrecto');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendCodeFn(verifyEmailAddr);
      setResendCooldown(60);
      setLocalError('');
    } catch (err) {
      setLocalError(err.message || 'Error al reenviar');
    }
  };

  const errorMsg = localError || authError;

  return (
    <div
      className="w-full h-full overflow-y-auto relative flex flex-col"
      style={{
        background: 'var(--bg-dark)',
        color: 'var(--text-primary)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Hero editorial superior con línea de ruta animada */}
      <div
        className="relative overflow-hidden px-5 pt-7 pb-6"
        style={{
          background: 'linear-gradient(180deg, rgba(255,194,26,0.08) 0%, rgba(13,16,20,0) 100%)',
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.48,
          }}
        >
          <path
            d="M -20 96 C 75 96, 110 34, 210 52 C 295 66, 330 20, 420 28"
            fill="none"
            stroke="#FFC21A"
            strokeWidth="2.2"
            strokeDasharray="8 6"
            className="android-hero-dash"
          />
          <path
            d="M -10 114 C 95 62, 195 104, 285 44 C 335 12, 370 40, 420 62"
            fill="none"
            stroke="#3B8BF0"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center text-center animate-spring-up">
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 15,
              overflow: 'hidden',
              background: 'var(--plate-bg)',
              border: '1.5px solid rgba(255, 194, 26, 0.35)',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.42)',
              marginBottom: 12,
            }}
          >
            <img src="/logo.png" alt="RutaQuilla" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <h1
            className="font-display m-0 flex items-center gap-1.5"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            <span>Ruta</span>
            <span
              style={{
                background: 'var(--plate-bg)',
                color: 'var(--plate-fg)',
                padding: '1px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255, 194, 26, 0.32)',
                fontSize: 19,
              }}
            >
              Quilla
            </span>
          </h1>
          <p className="mt-1.5 mb-0 text-[12.5px]" style={{ color: 'var(--text-secondary)', maxWidth: 270 }}>
            {verifyStep
              ? (twoFactorStep ? 'Confirma tu código de acceso' : 'Revisa tu correo para activar tu cuenta')
              : forgotStep
                ? 'Recupera el acceso a tu cuenta'
                : resetStep
                  ? 'Crea una nueva contraseña segura'
                  : 'Tu guía de buses por Barranquilla y su área metropolitana'}
          </p>
        </div>
      </div>

      {/* Tarjeta principal centrada */}
      <div className="px-4 flex-1 flex flex-col justify-start">
        <div
          className="w-full mx-auto rq-card animate-spring-up"
          style={{
            maxWidth: 420,
            padding: '18px 18px 20px',
            borderRadius: 20,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {verifyStep ? (
            <div>
              <p className="text-center text-xs mb-4 mt-0" style={{ color: 'var(--text-secondary)' }}>
                Código enviado a <strong style={{ color: 'var(--caribe)' }}>{verifyEmailAddr}</strong>
              </p>

              <div className="flex justify-center gap-1.5 mb-4">
                {verifyCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={codeRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    onPaste={i === 0 ? handleCodePaste : undefined}
                    autoFocus={i === 0}
                    className="font-mono tabular-nums"
                    style={{
                      flex: '1 1 0',
                      maxWidth: 44,
                      minWidth: 0,
                      height: 48,
                      borderRadius: 11,
                      background: digit ? 'var(--bg-surface)' : 'var(--bg-dark)',
                      border: `1.5px solid ${digit ? 'var(--brand)' : 'var(--border-color)'}`,
                      color: 'var(--text-primary)',
                      fontSize: 20,
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                      caretColor: 'var(--brand)',
                    }}
                  />
                ))}
              </div>

              {errorMsg && (
                <div
                  className="mb-3 p-2.5 rounded-xl flex items-center gap-2 text-xs"
                  style={{
                    background: 'rgba(229, 72, 77, 0.1)',
                    border: '1px solid rgba(229, 72, 77, 0.28)',
                    color: 'var(--carnaval)',
                  }}
                >
                  <Shield size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerifySubmit}
                disabled={verifyLoading || verifyCode.join('').length !== 6}
                className="rq-btn-primary rq-pressable w-full"
                style={{ padding: '12px' }}
              >
                {verifyLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                {verifyLoading ? 'Verificando...' : 'Confirmar código'}
              </button>

              <div className="text-center mt-3.5">
                {twoFactorStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyStep(false);
                      setTwoFactorStep(false);
                      setVerifyCode(['', '', '', '', '', '']);
                      setLocalError('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                  >
                    Volver al inicio de sesión
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--caribe)',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                  </button>
                )}
              </div>
            </div>
          ) : forgotStep ? (
            <form onSubmit={handleForgotSubmit}>
              <MobileField
                id="android-forgot-email"
                label="Correo electrónico"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                icon={Mail}
                autoFocus
              />

              {errorMsg && (
                <div
                  className="mt-2.5 p-2.5 rounded-xl flex items-center gap-2 text-xs"
                  style={{
                    background: 'rgba(229, 72, 77, 0.1)',
                    border: '1px solid rgba(229, 72, 77, 0.28)',
                    color: 'var(--carnaval)',
                  }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="rq-btn-primary rq-pressable w-full mt-3"
                style={{ padding: '12px' }}
              >
                {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {resetLoading ? 'Enviando...' : 'Enviar código'}
              </button>

              <button
                type="button"
                onClick={() => {
                  fxTap();
                  setForgotStep(false);
                  setLocalError('');
                }}
                className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 6 }}
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </button>
            </form>
          ) : resetStep ? (
            <form onSubmit={handleResetSubmit}>
              <MobileField
                id="android-reset-code"
                label="Código de 6 dígitos"
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                icon={KeyRound}
                autoFocus
              />
              <MobileField
                id="android-reset-pass"
                label="Nueva contraseña (mín. 8 caracteres)"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={Lock}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {errorMsg && (
                <div
                  className="mt-2 p-2.5 rounded-xl flex items-center gap-2 text-xs"
                  style={{
                    background: 'rgba(229, 72, 77, 0.1)',
                    border: '1px solid rgba(229, 72, 77, 0.28)',
                    color: 'var(--carnaval)',
                  }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="rq-btn-primary rq-pressable w-full mt-3"
                style={{ padding: '12px' }}
              >
                {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {resetLoading ? 'Actualizando...' : 'Guardar nueva contraseña'}
              </button>

              <button
                type="button"
                onClick={() => {
                  fxTap();
                  setResetStep(false);
                  setForgotStep(false);
                  setLocalError('');
                }}
                className="w-full mt-3 text-xs font-semibold"
                style={{ background: 'none', border: 'none', color: 'var(--caribe)', padding: 6 }}
              >
                Volver a iniciar sesión
              </button>
            </form>
          ) : (
            <>
              {/* Selector Iniciar sesión / Crear cuenta */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-surface)',
                  borderRadius: 11,
                  padding: 3,
                  border: '1px solid var(--border-color)',
                  marginBottom: 14,
                }}
              >
                {[
                  { id: 'login', label: 'Iniciar sesión' },
                  { id: 'register', label: 'Crear cuenta' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      fxTap();
                      setMode(m.id);
                      setLocalError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      background: mode === m.id ? 'var(--plate-bg)' : 'transparent',
                      color: mode === m.id ? 'var(--plate-fg)' : 'var(--text-muted)',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <MobileField
                    id="android-register-name"
                    label="Nombre completo"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    icon={User}
                  />
                )}

                <MobileField
                  id="android-auth-email"
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={Mail}
                />

                {emailSuggestion && (
                  <button
                    type="button"
                    onClick={() => setEmail(emailSuggestion)}
                    className="w-full text-left mb-2 px-3 py-1.5 rounded-lg text-[11.5px]"
                    style={{
                      background: 'rgba(255, 194, 26, 0.1)',
                      border: '1px solid rgba(255, 194, 26, 0.35)',
                      color: 'var(--brand)',
                    }}
                  >
                    ¿Quisiste decir <strong>{emailSuggestion}</strong>? Toca para corregir
                  </button>
                )}

                <MobileField
                  id="android-auth-password"
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={Lock}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                {mode === 'login' ? (
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        fxTap();
                        setResetEmail(email);
                        setForgotStep(true);
                        setLocalError('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--caribe)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                ) : (
                  <div className="mb-2">
                    {password.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{ color: password.length >= 8 ? 'var(--mangle)' : 'var(--brand)' }}>
                        {password.length >= 8 ? <Check size={12} /> : <AlertTriangle size={12} />}
                        <span>{password.length >= 8 ? 'Contraseña válida' : `Faltan ${8 - password.length} caracteres`}</span>
                      </div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <button
                        type="button"
                        onClick={() => setAcceptedTerms((v) => !v)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          marginTop: 1,
                          color: acceptedTerms ? 'var(--brand)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {acceptedTerms ? <CheckSquare size={17} /> : <Square size={17} />}
                      </button>
                      <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        Acepto la{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onShowLegal?.('privacy');
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--caribe)', padding: 0, textDecoration: 'underline', fontSize: 11 }}
                        >
                          Política de Privacidad
                        </button>{' '}
                        y los{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onShowLegal?.('terms');
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--caribe)', padding: 0, textDecoration: 'underline', fontSize: 11 }}
                        >
                          Términos y Condiciones
                        </button>
                      </span>
                    </label>
                  </div>
                )}

                {publicConfig?.turnstileEnabled && publicConfig?.turnstileSiteKey && (
                  <div className="my-2.5 flex justify-center">
                    <div ref={turnstileRef} />
                  </div>
                )}

                {errorMsg && (
                  <div
                    className="my-2.5 p-2.5 rounded-xl flex items-center gap-2 text-xs animate-fade-in"
                    style={{
                      background: 'rgba(229, 72, 77, 0.1)',
                      border: '1px solid rgba(229, 72, 77, 0.28)',
                      color: 'var(--carnaval)',
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || registrationDisabled}
                  className="rq-btn-primary rq-pressable w-full mt-2"
                  style={{
                    padding: '13px',
                    fontSize: 14,
                    opacity: isSubmitting || registrationDisabled ? 0.55 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {mode === 'login' ? 'Entrando...' : 'Creando cuenta...'}
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? 'Entrar a RutaQuilla' : 'Crear mi cuenta'}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Pie discreto con accesos rápidos de valor */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-flex items-center gap-1">
            <Navigation size={11} color="var(--brand)" /> GPS en tiempo real
          </span>
          <span>·</span>
          <span>Rutas offline</span>
        </div>
      </div>
    </div>
  );
}
