/**
 * ============================================
 * RutaQuilla - Servicio Anti-Bots y Auditoría de Emails
 * ============================================
 *
 * Funcionalidades sin dependencias externas:
 * 1. Tokens HMAC-SHA256 de formulario (anti-bot / tiempo mínimo de llenado / anti-replay)
 * 2. Verificación opcional con Cloudflare Turnstile si está configurado
 * 3. Bloqueo de correos desechables, errores tipográficos de dominio y DNS MX
 * 4. Motor forense para evaluar autenticidad de cuentas en el panel Admin
 */

const crypto = require('crypto');
const dns = require('dns').promises;
const axios = require('axios');
const { JWT_SECRET } = require('../config/jwt');

// Mapa de errores tipográficos comunes de escritura en móviles
const TYPO_DOMAINS = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.es': 'gmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmai.con': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'live.con': 'live.com',
};

// Proveedores de correos temporales / desechables frecuentes en ataques automatizados
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'mailinator.net', 'mailinator.org', 'yopmail.com', 'yopmail.fr',
  'yopmail.net', 'tempmail.com', 'tempmail.net', 'tempmail.org', 'temp-mail.org',
  'temp-mail.io', '10minutemail.com', '10minutemail.net', '10minemail.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me', 'trashmail.com',
  'trashmail.net', 'trashmail.org', 'dispostable.com', 'maildrop.cc', 'getnada.com',
  'nada.email', 'mohmal.com', 'fakeinbox.com', 'throwawaymail.com', 'mailnesia.com',
  'mintemail.com', 'mytemp.email', 'tempail.com', 'tempr.email', 'dropmail.me',
  'emailondeck.com', 'moakt.com', 'incognitomail.org', 'anonymbox.com',
  'burnermail.io', 'inboxbear.com', 'spamgourmet.com', 'mailcatch.com',
  'mailexpire.com', 'mailnull.com', 'meltmail.com', 'nowmymail.com',
  'owlpic.com', 'proxymail.eu', 'rcpt.at', 'recode.me', 'rppkn.com',
  'safetymail.info', 'sandelf.de', 'saynotospams.com', 'selfdestructingmail.com',
  'sendspamhere.com', 'shieldedmail.com', 'skeefmail.com', 'slopsbox.com',
  'smellfear.com', 'snakemail.com', 'sneakemail.com', 'snkmail.com',
  'sofimail.com', 'sogetthis.com', 'soodonims.com', 'spam.la', 'spamavert.com',
  'spambob.net', 'spambog.com', 'spambox.us', 'spamcannon.com', 'spamcero.com',
  'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com', 'spamday.com',
  'spamex.com', 'spamfree24.org', 'spamhole.com', 'spaml.com', 'spamoff.de',
  'spamslicer.com', 'spamspot.com', 'spamthis.co.uk', 'speed.1s.fr',
  'supergreatmail.com', 'supermailer.jp', 'suremail.info', 'tmailinator.com',
  'tradermail.info', 'wegwerfmail.de', 'wh4f.org', 'zehnminutenmail.de',
  'zippymail.info', 'zoemail.net', 'mail-temporaire.fr', 'crazymailing.com',
]);

const DEMO_DOMAINS = new Set(['rutaquilla.com', 'example.com', 'test.com', 'invalid.com']);

// Caché DNS MX (6 horas) y Nonces de tokens anti-bot consumidos
const MX_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const mxCache = new Map();
const usedNonces = new Map();
const MAX_NONCE_CACHE = 5000;

function cleanupUsedNonces() {
  const now = Date.now();
  for (const [nonce, exp] of usedNonces.entries()) {
    if (exp <= now || usedNonces.size > MAX_NONCE_CACHE) {
      usedNonces.delete(nonce);
    }
    if (usedNonces.size <= MAX_NONCE_CACHE && exp > now) break;
  }
}

/**
 * Emite un token HMAC firmado con timestamp y nonce único para proteger formularios de Auth.
 */
function issueFormToken() {
  const ts = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${ts}.${nonce}`)
    .digest('hex');
  return `${ts}.${nonce}.${sig}`;
}

/**
 * Valida firma, ventana de tiempo (mínimo 1.5s para evitar envío instantáneo de bots) y uso único.
 */
function verifyFormToken(token, { minAgeMs = 1500, maxAgeMs = 2 * 60 * 60 * 1000, consumeNonce = true } = {}) {
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'MISSING_TOKEN' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'MALFORMED_TOKEN' };
  }
  const [tsStr, nonce, sig] = parts;
  if (!/^\d{10,16}$/.test(tsStr) || !/^[a-f0-9]{16}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${tsStr}.${nonce}`)
    .digest('hex');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }

  const ts = parseInt(tsStr, 10);
  const age = Date.now() - ts;
  if (age < minAgeMs) {
    return { ok: false, reason: 'TOO_FAST' };
  }
  if (age > maxAgeMs) {
    return { ok: false, reason: 'EXPIRED' };
  }

  if (consumeNonce) {
    cleanupUsedNonces();
    if (usedNonces.has(nonce)) {
      return { ok: false, reason: 'REPLAYED' };
    }
    usedNonces.set(nonce, ts + maxAgeMs);
  } else if (usedNonces.has(nonce)) {
    return { ok: false, reason: 'REPLAYED' };
  }

  return { ok: true, ageMs: age, nonce, ts };
}

/**
 * Consume explícitamente el nonce de un formToken ya validado (una vez superadas las demás validaciones).
 */
function consumeFormTokenNonce(token, maxAgeMs = 2 * 60 * 60 * 1000) {
  if (typeof token !== 'string') return;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return;
  const [tsStr, nonce] = parts;
  const ts = parseInt(tsStr, 10) || Date.now();
  cleanupUsedNonces();
  usedNonces.set(nonce, ts + maxAgeMs);
}

/**
 * Verifica token de Cloudflare Turnstile si TURNSTILE_SECRET_KEY está configurado.
 */
async function verifyTurnstileToken(token, remoteIp = '') {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    return { ok: true, skipped: true };
  }
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'MISSING_TURNSTILE' };
  }

  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token.trim());
    if (remoteIp) form.append('remoteip', remoteIp);

    const resp = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      form.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      }
    );
    return {
      ok: Boolean(resp.data?.success),
      errorCodes: resp.data?.['error-codes'] || [],
    };
  } catch (err) {
    console.warn('⚠️ Turnstile verification request failed:', err.message);
    return { ok: false, reason: 'TURNSTILE_UNREACHABLE' };
  }
}

/**
 * Consulta registros DNS MX con timeout de 3.5s y caché en memoria (6h).
 */
async function checkDomainMx(rawDomain) {
  const domain = String(rawDomain || '').trim().toLowerCase();
  if (!domain || !domain.includes('.')) {
    return { domain, valid: false, status: 'INVALID_DOMAIN', count: 0 };
  }

  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.ts < MX_CACHE_TTL_MS) {
    return cached.value;
  }

  let timer = null;
  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('DNS_TIMEOUT'), { code: 'ETIMEOUT' })), 3500);
      }),
    ]);
    clearTimeout(timer);

    const valid = Array.isArray(mxRecords) && mxRecords.length > 0;
    const value = {
      domain,
      valid,
      status: valid ? 'VALID_MX' : 'NO_MX',
      count: Array.isArray(mxRecords) ? mxRecords.length : 0,
    };
    mxCache.set(domain, { ts: Date.now(), value });
    return value;
  } catch (err) {
    clearTimeout(timer);
    const code = err?.code || 'ERR';
    if (code === 'ETIMEOUT' || code === 'EAI_AGAIN') {
      return { domain, valid: null, status: 'TIMEOUT', count: 0 };
    }
    const value = { domain, valid: false, status: 'NO_MX', code, count: 0 };
    mxCache.set(domain, { ts: Date.now(), value });
    return value;
  }
}

/**
 * Detecta cadenas tipo aporreo de teclado (ej. "hdjdjdhdjdjdjdj8", "sjsjsjleoxd").
 */
function isKeyboardMash(raw) {
  const letters = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (letters.length < 6) return false;
  // Secuencia repetitiva de 2 caracteres 3+ veces seguidas (ej. "jdjdjdjd", "sjsjsj")
  if (/(..)\1{2,}/.test(letters)) return true;
  // 7+ consonantes seguidas sin vocales ni 'y'
  if (/[bcdfghjklmnpqrstvwxz]{7,}/.test(letters)) return true;
  return false;
}

/**
 * Valida un registro nuevo contra dominios temporales, typos comunes, lista negra y DNS MX.
 */
async function validateRegistrationEmail(email, name = '', customBlockedDomains = []) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx <= 0) {
    return { valid: false, code: 'INVALID_EMAIL', message: 'El formato del correo electrónico no es válido' };
  }

  const localPart = cleanEmail.slice(0, atIdx);
  const domain = cleanEmail.slice(atIdx + 1);

  if (TYPO_DOMAINS[domain]) {
    const suggestedDomain = TYPO_DOMAINS[domain];
    return {
      valid: false,
      code: 'EMAIL_DOMAIN_TYPO',
      suggestedEmail: `${localPart}@${suggestedDomain}`,
      message: `Parece que hay un error al escribir tu correo (@${domain}). ¿Quisiste decir ${localPart}@${suggestedDomain}?`,
    };
  }

  const customSet = new Set((customBlockedDomains || []).map((d) => String(d || '').toLowerCase()));
  if (DISPOSABLE_DOMAINS.has(domain) || customSet.has(domain) || DEMO_DOMAINS.has(domain)) {
    return {
      valid: false,
      code: 'DISPOSABLE_EMAIL_BLOCKED',
      message: 'No se permiten correos temporales o dominios bloqueados. Usa tu correo personal o institucional.',
    };
  }

  const mx = await checkDomainMx(domain);
  if (mx.valid === false) {
    return {
      valid: false,
      code: 'INVALID_EMAIL_DOMAIN',
      message: `El dominio @${domain} no existe o no puede recibir correos. Verifica que esté bien escrito.`,
    };
  }

  // Bloqueo suave de obvios keyboard-mash sin afectar nombres cortos válidos
  if (isKeyboardMash(localPart) && isKeyboardMash(name)) {
    return {
      valid: false,
      code: 'SUSPICIOUS_ACCOUNT_INPUT',
      message: 'Por favor ingresa un nombre y correo electrónico reales para continuar.',
    };
  }

  return { valid: true, mxStatus: mx.status };
}

/**
 * Evalúa la autenticidad y señales de riesgo de un usuario existente para Auditoría Admin.
 */
function analyzeUserAccount(user, { mxMap = new Map(), prevCreatedAt = null, nextCreatedAt = null, blockedDomains = [] } = {}) {
  const email = String(user?.email || '').toLowerCase();
  const [localPart = '', domain = ''] = email.split('@');
  const mxInfo = mxMap.get(domain) || { valid: null, status: 'UNKNOWN' };
  const blockedSet = new Set((blockedDomains || []).map((d) => String(d || '').toLowerCase()));

  const flags = [];
  let suggestedEmail = null;

  if (DEMO_DOMAINS.has(domain)) {
    flags.push('Cuenta demo/semilla inicial');
  }

  if (TYPO_DOMAINS[domain]) {
    suggestedEmail = `${localPart}@${TYPO_DOMAINS[domain]}`;
    flags.push(`Error de dominio: ¿@${TYPO_DOMAINS[domain]}?`);
  }

  if (DISPOSABLE_DOMAINS.has(domain) || blockedSet.has(domain)) {
    flags.push('Dominio temporal o bloqueado');
  }

  if (mxInfo.valid === false && !DEMO_DOMAINS.has(domain)) {
    flags.push('Dominio sin servidor de correo (MX inválido)');
  }

  if (isKeyboardMash(localPart) || isKeyboardMash(user?.name || '')) {
    flags.push('Nombre o correo con patrón aleatorio de teclado');
  }

  const createdMs = new Date(user?.createdAt || 0).getTime();
  const closeToNeighbor =
    (prevCreatedAt && Math.abs(createdMs - prevCreatedAt) <= 90 * 1000) ||
    (nextCreatedAt && Math.abs(nextCreatedAt - createdMs) <= 90 * 1000);
  if (closeToNeighbor) {
    flags.push('Registro consecutivo (<90s respecto a otra cuenta)');
  }

  const ageDays = (Date.now() - createdMs) / (24 * 60 * 60 * 1000);
  const isInstitutional = /\.(edu|gov|org)\.co$/i.test(domain) || domain === 'rutaquilla.me';

  let classification = 'verified_human';
  let label = 'Persona verificada';
  let severity = 'ok';

  if (DEMO_DOMAINS.has(domain)) {
    classification = 'demo_account';
    label = 'Cuenta demo';
    severity = 'danger';
  } else if (TYPO_DOMAINS[domain] || DISPOSABLE_DOMAINS.has(domain) || blockedSet.has(domain) || mxInfo.valid === false) {
    classification = 'typo_or_nomx';
    label = 'Dominio inválido / Typo';
    severity = 'danger';
  } else if (isKeyboardMash(localPart) || isKeyboardMash(user?.name || '')) {
    classification = 'suspicious_pattern';
    label = 'Patrón sospechoso';
    severity = 'warning';
  } else if (!user?.isVerified) {
    if (ageDays > 7) {
      classification = 'unverified_stale';
      label = 'Sin verificar (+7d)';
      severity = 'warning';
      flags.push('No completó código OTP');
    } else {
      classification = 'unverified_recent';
      label = 'Pendiente reciente';
      severity = 'info';
      flags.push('Pendiente de código OTP');
    }
  } else if (isInstitutional) {
    classification = 'institutional';
    label = 'Institucional verificado';
    severity = 'ok';
  }

  return {
    classification,
    label,
    severity,
    flags,
    suggestedEmail,
    mxStatus: mxInfo.status || 'UNKNOWN',
  };
}

module.exports = {
  TYPO_DOMAINS,
  DISPOSABLE_DOMAINS,
  DEMO_DOMAINS,
  issueFormToken,
  verifyFormToken,
  consumeFormTokenNonce,
  verifyTurnstileToken,
  checkDomainMx,
  isKeyboardMash,
  validateRegistrationEmail,
  analyzeUserAccount,
};
