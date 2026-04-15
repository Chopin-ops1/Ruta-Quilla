/**
 * ============================================
 * RutaQuilla - Modal de Login/Registro v2
 * ============================================
 * Diseño premium: glassmorphism + gradientes + animaciones
 */

import { useState, useRef, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Bus, Crown, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
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

export default function LoginModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register, error: authError } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setEmail(''); setPassword(''); setName('');
      setLocalError(''); setMode('login');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) { setLocalError('El nombre es requerido'); setIsSubmitting(false); return; }
        await register(name, email, password);
      }
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = (type) => {
    if (type === 'free') { setEmail('demo@rutaquilla.com'); setPassword('demo123'); }
    else { setEmail('premium@rutaquilla.com'); setPassword('premium123'); }
    setMode('login');
  };

  const errorMsg = localError || authError;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Animated backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
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

        {/* Close button */}
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

        {/* Hero section */}
        <div style={{ padding: '36px 36px 24px', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: 68, height: 68, borderRadius: 20, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #92400E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(245,158,11,0.35), 0 0 0 1px rgba(245,158,11,0.2) inset',
          }}>
            <Bus size={32} color="#000" strokeWidth={2.5} />
          </div>

          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 26, fontWeight: 700,
            color: '#F1F5F9', marginBottom: 6, lineHeight: 1.2,
          }}>
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
            {mode === 'login'
              ? 'Conecta con el transporte de Barranquilla'
              : 'Únete a la comunidad de transporte colectivo'}
          </p>
        </div>

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
            disabled={isSubmitting}
            id="submit-auth-btn"
            style={{
              width: '100%', marginTop: 20, padding: '15px 0',
              borderRadius: 16, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
              background: isSubmitting
                ? 'rgba(245,158,11,0.4)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#000', fontSize: 14, fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: isSubmitting ? 'none' : '0 8px 24px rgba(245,158,11,0.35)',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (!isSubmitting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(245,158,11,0.45)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isSubmitting ? 'none' : '0 8px 24px rgba(245,158,11,0.35)'; }}
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
              : <>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <ArrowRight size={16} /></>
            }
          </button>

          {/* Demo accounts */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Acceso rápido — demostración
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => fillDemo('free')}
                id="demo-free-btn"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#94A3B8', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#F1F5F9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94A3B8'; }}
              >
                <User size={13} /> Free
              </button>
              <button
                type="button"
                onClick={() => fillDemo('premium')}
                id="demo-premium-btn"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.12))',
                  border: '1px solid rgba(245,158,11,0.25)',
                  color: '#FBBF24', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(217,119,6,0.22))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.12))'; }}
              >
                <Crown size={13} /> Premium
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
