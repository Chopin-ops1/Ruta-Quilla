/**
 * Motor sutil de retroalimentación sonora (Web Audio API) + vibración háptica nativa.
 * Diseñado con ondas suaves filtradas y envolventes limpias para evitar clics o estridencia.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

const SOUND_MUTE_KEY = 'rutaquilla_sound_muted';
let audioCtx = null;

export function isSoundMuted() {
  try {
    return localStorage.getItem(SOUND_MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(SOUND_MUTE_KEY, muted ? 'true' : 'false');
  } catch {}
  return muted;
}

export function toggleSoundMuted() {
  return setSoundMuted(!isSoundMuted());
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSoftNote({
  freq = 440,
  endFreq = null,
  delay = 0,
  duration = 0.08,
  volume = 0.055,
  type = 'sine',
  cutoff = 2200,
}) {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.016, duration * 0.28));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (_) {}
}

async function triggerImpact(style = ImpactStyle.Light, fallbackMs = 15) {
  try {
    if (isNativeApp()) {
      await Haptics.impact({ style });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(fallbackMs);
    }
  } catch (_) {}
}

async function triggerNotification(type = NotificationType.Success, fallbackPattern = [20, 40, 20]) {
  try {
    if (isNativeApp()) {
      await Haptics.notification({ type });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(fallbackPattern);
    }
  } catch (_) {}
}

export function fxTap() {
  playSoftNote({ freq: 520, endFreq: 420, duration: 0.028, volume: 0.032, type: 'sine', cutoff: 1800 });
  triggerImpact(ImpactStyle.Light, 10);
}

export function fxPinDrop() {
  playSoftNote({ freq: 340, endFreq: 560, duration: 0.055, volume: 0.048, type: 'triangle', cutoff: 2000 });
  triggerImpact(ImpactStyle.Light, 16);
}

export function fxLoginSuccess() {
  playSoftNote({ freq: 349.23, delay: 0.0, duration: 0.14, volume: 0.055, type: 'sine', cutoff: 2200 });
  playSoftNote({ freq: 523.25, delay: 0.075, duration: 0.16, volume: 0.06, type: 'sine', cutoff: 2400 });
  playSoftNote({ freq: 698.46, delay: 0.15, duration: 0.24, volume: 0.055, type: 'triangle', cutoff: 2500 });
  triggerNotification(NotificationType.Success, [18, 45, 25]);
}

export function fxSearchStart() {
  playSoftNote({ freq: 440, endFreq: 587.33, duration: 0.07, volume: 0.04, type: 'sine', cutoff: 2000 });
  triggerImpact(ImpactStyle.Light, 12);
}

export function fxRouteFound() {
  playSoftNote({ freq: 392.0, delay: 0.0, duration: 0.12, volume: 0.055, type: 'sine', cutoff: 2200 });
  playSoftNote({ freq: 587.33, delay: 0.07, duration: 0.22, volume: 0.065, type: 'triangle', cutoff: 2400 });
  triggerImpact(ImpactStyle.Medium, 22);
}

export function fxCaptureStart() {
  playSoftNote({ freq: 330, delay: 0.0, duration: 0.11, volume: 0.055, type: 'sine', cutoff: 1900 });
  playSoftNote({ freq: 493.88, delay: 0.09, duration: 0.18, volume: 0.06, type: 'triangle', cutoff: 2200 });
  triggerNotification(NotificationType.Success, [25, 50, 25]);
}

export function fxCaptureSaved() {
  playSoftNote({ freq: 440, delay: 0.0, duration: 0.12, volume: 0.055, type: 'sine', cutoff: 2200 });
  playSoftNote({ freq: 554.37, delay: 0.08, duration: 0.13, volume: 0.055, type: 'sine', cutoff: 2400 });
  playSoftNote({ freq: 659.25, delay: 0.16, duration: 0.26, volume: 0.06, type: 'triangle', cutoff: 2600 });
  triggerNotification(NotificationType.Success, [20, 40, 35]);
}

export function fxBoardBus() {
  playSoftNote({ freq: 523.25, delay: 0.0, duration: 0.15, volume: 0.075, type: 'triangle', cutoff: 2400 });
  playSoftNote({ freq: 659.25, delay: 0.11, duration: 0.22, volume: 0.08, type: 'sine', cutoff: 2500 });
  triggerImpact(ImpactStyle.Medium, [100, 50, 100]);
}

export function fxAlightAlert() {
  playSoftNote({ freq: 659.25, delay: 0.0, duration: 0.16, volume: 0.10, type: 'triangle', cutoff: 2600 });
  playSoftNote({ freq: 880.0, delay: 0.13, duration: 0.22, volume: 0.10, type: 'sine', cutoff: 2800 });
  playSoftNote({ freq: 659.25, delay: 0.42, duration: 0.16, volume: 0.10, type: 'triangle', cutoff: 2600 });
  playSoftNote({ freq: 880.0, delay: 0.55, duration: 0.28, volume: 0.11, type: 'sine', cutoff: 2800 });
  triggerNotification(NotificationType.Warning, [260, 140, 260, 140, 420]);
}

export function fxArrived() {
  playSoftNote({ freq: 523.25, delay: 0.0, duration: 0.13, volume: 0.07, type: 'sine', cutoff: 2400 });
  playSoftNote({ freq: 659.25, delay: 0.09, duration: 0.15, volume: 0.075, type: 'sine', cutoff: 2600 });
  playSoftNote({ freq: 783.99, delay: 0.18, duration: 0.28, volume: 0.08, type: 'triangle', cutoff: 2800 });
  triggerNotification(NotificationType.Success, [160, 80, 200]);
}
