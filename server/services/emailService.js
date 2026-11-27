/**
 * ============================================
 * RutaQuilla - Email Service (Zoho Mail)
 * ============================================
 * 
 * Servicio de envío de correos con Nodemailer + Zoho SMTP.
 * Incluye plantilla HTML profesional para verificación de cuentas.
 */

const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { escapeHtml } = require('../middleware/security');

// Crear transporter con Zoho Mail SMTP (timeouts acotados para detectar puertos bloqueados)
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, // SSL
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 8000,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD,
  },
});

function getEmailProvider() {
  if ((process.env.RESEND_API_KEY || '').trim()) return 'resend';
  if ((process.env.BREVO_API_KEY || '').trim()) return 'brevo';
  if ((process.env.ZOHO_EMAIL || '').trim() && (process.env.ZOHO_PASSWORD || '').trim()) {
    return 'zoho-smtp';
  }
  return 'none';
}

function isEmailConfigured() {
  return getEmailProvider() !== 'none';
}

function getSenderConfig() {
  const provider = getEmailProvider();
  const fromEnv = (process.env.EMAIL_FROM || '').trim();
  const zohoEnv = (process.env.ZOHO_EMAIL || '').trim();
  const fallback = provider === 'resend' ? 'onboarding@resend.dev' : zohoEnv;
  const email = fromEnv || zohoEnv || fallback;
  const name = 'RutaQuilla';
  const formatted = email.includes('<') ? email : `"${name}" <${email}>`;
  return { email, name, formatted };
}

async function sendMailPayload({ to, subject, html, text }) {
  const provider = getEmailProvider();
  const sender = getSenderConfig();

  if (provider === 'resend') {
    const resp = await axios.post(
      'https://api.resend.com/emails',
      {
        from: sender.formatted,
        to: [to],
        subject,
        html,
        text,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
    return { messageId: resp.data?.id || 'resend' };
  }

  if (provider === 'brevo') {
    const resp = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: sender.name, email: sender.email },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
    return { messageId: resp.data?.messageId || 'brevo' };
  }

  if (provider === 'zoho-smtp') {
    return transporter.sendMail({
      from: sender.formatted,
      to,
      subject,
      html,
      text,
    });
  }

  throw new Error('Servicio de correo no configurado');
}

/**
 * Genera un código de verificación criptográficamente seguro de 6 dígitos.
 */
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Sanitiza texto para headers de email (previene header injection con CR/LF).
 */
function sanitizeEmailHeader(str) {
  return String(str || '').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Plantilla HTML profesional para el email de verificación.
 */
function getVerificationEmailHTML(userName, code) {
  const safeName = escapeHtml(userName);
  const safeCode = escapeHtml(code);
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0B1120; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B1120; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" style="max-width: 480px; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          
          <!-- Gradient top bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #F59E0B, #06B6D4, #8B5CF6);"></td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="background: linear-gradient(145deg, #111827 0%, #0B1120 100%); padding: 40px 36px;">
              
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-block; width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, #F59E0B, #D97706); text-align: center; line-height: 64px; font-size: 30px; box-shadow: 0 8px 24px rgba(245,158,11,0.35);">
                  🚌
                </div>
              </div>

              <!-- Title -->
              <h1 style="margin: 0 0 8px; text-align: center; font-size: 24px; font-weight: 700; color: #F1F5F9; letter-spacing: -0.02em;">
                Verifica tu cuenta
              </h1>
              <p style="margin: 0 0 30px; text-align: center; font-size: 14px; color: #64748B; line-height: 1.6;">
                Hola <strong style="color: #94A3B8;">${safeName}</strong>, usa este código para completar tu registro en RutaQuilla.
              </p>

              <!-- Code box -->
              <div style="background: rgba(245,158,11,0.06); border: 2px solid rgba(245,158,11,0.2); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 8px; font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600;">
                  Tu código de verificación
                </p>
                <div style="font-size: 36px; font-weight: 800; color: #F59E0B; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(245,158,11,0.3);">
                  ${safeCode}
                </div>
                <p style="margin: 12px 0 0; font-size: 12px; color: #475569;">
                  Este código expira en <strong style="color: #F59E0B;">15 minutos</strong>
                </p>
              </div>

              <!-- Instructions -->
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; margin-bottom: 28px;">
                <p style="margin: 0 0 10px; font-size: 12px; font-weight: 600; color: #94A3B8;">
                  📋 Instrucciones:
                </p>
                <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: #64748B; line-height: 1.8;">
                  <li>Copia el código de arriba</li>
                  <li>Vuelve a RutaQuilla</li>
                  <li>Pégalo en el campo de verificación</li>
                  <li>¡Listo! Tu cuenta estará activa</li>
                </ol>
              </div>

              <!-- Security notice -->
              <p style="margin: 0; font-size: 11px; color: #334155; text-align: center; line-height: 1.6;">
                🔒 Si no solicitaste este código, ignora este correo.<br>
                Tu cuenta no se activará hasta que verifiques.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: rgba(255,255,255,0.02); padding: 20px 36px; border-top: 1px solid rgba(255,255,255,0.06);">
              <p style="margin: 0; text-align: center; font-size: 11px; color: #334155;">
                <strong style="color: #475569;">RutaQuilla</strong> — Transporte inteligente para Barranquilla 🇨🇴
              </p>
              <p style="margin: 6px 0 0; text-align: center; font-size: 10px; color: #1E293B;">
                Este es un correo automático. No respondas a este mensaje.
              </p>
            </td>
          </tr>

          <!-- Bottom gradient bar -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #F59E0B, #06B6D4, #8B5CF6);"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el email de verificación.
 * 
 * @param {string} to - Email del destinatario
 * @param {string} userName - Nombre del usuario
 * @param {string} code - Código de 6 dígitos
 */
async function sendVerificationEmail(to, userName, code) {
  const safeSubjectName = sanitizeEmailHeader(userName);
  const safeSubjectCode = sanitizeEmailHeader(code);
  const subject = `🚌 Tu código de verificación: ${safeSubjectCode} — RutaQuilla`;
  const html = getVerificationEmailHTML(userName, code);
  const text = `Hola ${safeSubjectName}, tu código de verificación en RutaQuilla es: ${safeSubjectCode}. Este código expira en 15 minutos.`;

  try {
    const info = await sendMailPayload({ to, subject, html, text });
    console.log(`✉️ Email de verificación enviado a ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    throw new Error('No se pudo enviar el email de verificación');
  }
}

/**
 * Verifica que el servicio de correo configurado responda (HTTPS o SMTP).
 */
async function verifyConnection() {
  const provider = getEmailProvider();
  if (provider === 'none') {
    console.warn('⚠️ Sin proveedor de correo configurado — verificación por email deshabilitada');
    return false;
  }
  if (provider === 'resend' || provider === 'brevo') {
    console.log(`✅ Servicio de correo HTTPS listo (${provider})`);
    return true;
  }
  const status = await verifySmtpStatus({ force: true });
  if (status.connected) {
    console.log('✅ Conexión SMTP con Zoho Mail verificada');
    return true;
  }
  console.warn(`⚠️ ${status.error}`);
  return false;
}

/**
 * Envía email de felicitación al alcanzar 500 XP (Quilla Builder).
 * Incluye incentivo para apoyar el proyecto.
 */
async function sendQuillaBuilderEmail(to, userName) {
  const safeName = escapeHtml(userName);
  const safeSubjectName = sanitizeEmailHeader(userName);
  const subject = `⚡ ¡${safeSubjectName}, alcanzaste Quilla Builder! — RutaQuilla`;
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1120;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" style="max-width:480px;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <tr><td style="height:4px;background:linear-gradient(90deg,#F59E0B,#06B6D4,#8B5CF6);"></td></tr>
        <tr><td style="background:linear-gradient(145deg,#111827,#0B1120);padding:40px 36px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#F59E0B,#D97706);text-align:center;line-height:64px;font-size:30px;box-shadow:0 8px 24px rgba(245,158,11,0.35);">⚡</div>
          </div>
          <h1 style="margin:0 0 8px;text-align:center;font-size:24px;font-weight:700;color:#F1F5F9;">¡Eres Quilla Builder!</h1>
          <p style="margin:0 0 20px;text-align:center;font-size:14px;color:#64748B;line-height:1.6;">
            <strong style="color:#F59E0B;">${safeName}</strong>, alcanzaste <strong style="color:#F59E0B;">500 XP</strong> contribuyendo a la comunidad de transporte de Barranquilla.
          </p>
          <div style="background:rgba(245,158,11,0.06);border:2px solid rgba(245,158,11,0.2);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:28px;">🏆</p>
            <p style="margin:0;font-size:14px;color:#E2E8F0;font-weight:600;">Has desbloqueado la insignia</p>
            <p style="margin:4px 0 0;font-size:16px;color:#F59E0B;font-weight:700;">⚡ Quilla Builder</p>
          </div>
          <p style="margin:0 0 20px;font-size:13px;color:#94A3B8;text-align:center;line-height:1.6;">
            Gracias a personas como tú, RutaQuilla está construyendo el mapa de transporte público más completo de Barranquilla. 🇨🇴
          </p>
          <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:16px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#8B5CF6;font-weight:600;">¿Quieres apoyar el proyecto?</p>
            <p style="margin:0;font-size:11px;color:#64748B;">Como Quilla Builder, tienes un <strong style="color:#F59E0B;">30% de descuento</strong> en Quilla-Pass. Contacta al equipo para activarlo.</p>
          </div>
        </td></tr>
        <tr><td style="background:rgba(255,255,255,0.02);padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;text-align:center;font-size:11px;color:#334155;"><strong style="color:#475569;">RutaQuilla</strong> — Transporte inteligente para Barranquilla 🇨🇴</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#F59E0B,#06B6D4,#8B5CF6);"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `¡Felicidades ${userName}! Alcanzaste 500 XP en RutaQuilla y desbloqueaste la insignia Quilla Builder. Gracias por contribuir al transporte público de Barranquilla.`;

  try {
    const info = await sendMailPayload({ to, subject, html, text });
    console.log(`⚡ Email Quilla Builder enviado a ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email Quilla Builder:', error.message);
    throw error;
  }
}

/**
 * Envía el código de recuperación de contraseña (expira en 15 minutos).
 */
async function sendPasswordResetEmail(to, userName, code) {
  const safeName = escapeHtml(userName);
  const safeCode = escapeHtml(code);
  const safeSubjectCode = sanitizeEmailHeader(code);
  const safeSubjectName = sanitizeEmailHeader(userName);

  const mailOptions = {
    to,
    subject: `🔐 Código de recuperación: ${safeSubjectCode} — RutaQuilla`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#070C17;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#070C17;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" style="max-width:480px;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <tr><td style="height:4px;background:linear-gradient(90deg,#F59E0B,#06B6D4,#8B5CF6);"></td></tr>
        <tr><td style="background:linear-gradient(145deg,#131E32,#070C17);padding:40px 36px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#06B6D4,#0891B2);text-align:center;line-height:64px;font-size:30px;box-shadow:0 8px 24px rgba(6,182,212,0.3);">🔐</div>
          </div>
          <h1 style="margin:0 0 8px;text-align:center;font-size:22px;font-weight:700;color:#F8FAFC;">Recuperar contraseña</h1>
          <p style="margin:0 0 28px;text-align:center;font-size:14px;color:#94A3B8;line-height:1.6;">
            Hola <strong style="color:#F8FAFC;">${safeName}</strong>, recibimos una solicitud para restablecer tu contraseña en RutaQuilla.
          </p>
          <div style="background:rgba(6,182,212,0.08);border:2px solid rgba(6,182,212,0.25);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;font-weight:600;">Código de recuperación</p>
            <div style="font-size:36px;font-weight:800;color:#06B6D4;letter-spacing:8px;font-family:'Courier New',monospace;">${safeCode}</div>
            <p style="margin:12px 0 0;font-size:12px;color:#64748B;">Este código expira en <strong style="color:#F59E0B;">15 minutos</strong></p>
          </div>
          <p style="margin:0;font-size:11px;color:#64748B;text-align:center;line-height:1.6;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual no ha cambiado.
          </p>
        </td></tr>
        <tr><td style="background:rgba(255,255,255,0.02);padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;text-align:center;font-size:11px;color:#64748B;"><strong style="color:#94A3B8;">RutaQuilla</strong> — Transporte inteligente para Barranquilla 🇨🇴</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#F59E0B,#06B6D4,#8B5CF6);"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Hola ${safeSubjectName}, tu código para restablecer contraseña en RutaQuilla es: ${safeSubjectCode}. Expira en 15 minutos.`,
  };

  try {
    const info = await sendMailPayload(mailOptions);
    console.log(`🔐 Email de recuperación enviado a ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email de recuperación:', error.message);
    throw new Error('No se pudo enviar el email de recuperación');
  }
}

/**
 * Envía el código OTP de segundo factor (2FA) al iniciar sesión como Administrador.
 */
async function sendAdminLoginOtpEmail(to, userName, code) {
  const safeName = escapeHtml(userName);
  const safeCode = escapeHtml(code);
  const safeSubjectCode = sanitizeEmailHeader(code);
  const safeSubjectName = sanitizeEmailHeader(userName);

  const mailOptions = {
    to,
    subject: `🛡️ Código de acceso Admin: ${safeSubjectCode} — RutaQuilla`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:'Segoe UI',Tahoma,Geneva,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1120;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" style="max-width:480px;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <tr><td style="height:4px;background:linear-gradient(90deg,#FFC21A,#E5484D);"></td></tr>
        <tr><td style="background:#14171C;padding:36px 32px;">
          <h1 style="margin:0 0 8px;text-align:center;font-size:21px;font-weight:700;color:#F8FAFC;">Acceso de Administrador (2FA)</h1>
          <p style="margin:0 0 24px;text-align:center;font-size:13.5px;color:#94A3B8;line-height:1.55;">
            Hola <strong style="color:#F8FAFC;">${safeName}</strong>, ingresa este código de seguridad para completar tu inicio de sesión en el Centro de Control de RutaQuilla.
          </p>
          <div style="background:rgba(255,194,26,0.08);border:2px solid rgba(255,194,26,0.3);border-radius:14px;padding:20px;text-align:center;margin-bottom:20px;">
            <p style="margin:0 0 6px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;">Código 2FA</p>
            <div style="font-size:34px;font-weight:800;color:#FFC21A;letter-spacing:8px;font-family:'Courier New',monospace;">${safeCode}</div>
            <p style="margin:10px 0 0;font-size:12px;color:#94A3B8;">Válido durante <strong style="color:#FFC21A;">10 minutos</strong></p>
          </div>
          <p style="margin:0;font-size:11px;color:#64748B;text-align:center;line-height:1.5;">
            Si no fuiste tú quien intentó ingresar, cambia tu contraseña de inmediato.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Hola ${safeSubjectName}, tu código 2FA de acceso administrativo en RutaQuilla es: ${safeSubjectCode}. Expira en 10 minutos.`,
  };

  try {
    const info = await sendMailPayload(mailOptions);
    console.log(`🛡️ Código 2FA Admin enviado a ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email 2FA Admin:', error.message);
    throw new Error('No se pudo enviar el código de seguridad 2FA');
  }
}

/**
 * Verifica conectividad real del servicio de correo (HTTPS inmediato o SMTP con caché).
 */
let smtpStatusCache = { checkedAt: 0, provider: null, result: null };
async function verifySmtpStatus({ force = false } = {}) {
  const provider = getEmailProvider();
  if (provider === 'none') {
    return {
      configured: false,
      connected: false,
      provider: 'none',
      error: 'Sin proveedor de correo configurado',
    };
  }

  if (provider === 'resend' || provider === 'brevo') {
    return { configured: true, connected: true, provider, error: null };
  }

  const ttlMs = smtpStatusCache.result?.connected ? 2 * 60 * 1000 : 5 * 60 * 1000;
  if (!force && smtpStatusCache.provider === provider && smtpStatusCache.result && Date.now() - smtpStatusCache.checkedAt < ttlMs) {
    return smtpStatusCache.result;
  }

  let timer = null;
  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('SMTP timeout (4s)')), 4000);
      }),
    ]);
    clearTimeout(timer);
    const result = { configured: true, connected: true, provider: 'zoho-smtp', error: null };
    smtpStatusCache = { checkedAt: Date.now(), provider, result };
    return result;
  } catch (_) {
    clearTimeout(timer);
    const result = {
      configured: true,
      connected: false,
      provider: 'zoho-smtp',
      error: 'Zoho SMTP no responde (Render Free bloquea puertos SMTP 465/587; configura RESEND_API_KEY o BREVO_API_KEY por HTTPS)',
    };
    smtpStatusCache = { checkedAt: Date.now(), provider, result };
    return result;
  }
}

async function isEmailDeliveryReady() {
  const status = await verifySmtpStatus();
  return Boolean(status.connected);
}

module.exports = {
  getEmailProvider,
  isEmailConfigured,
  isEmailDeliveryReady,
  generateVerificationCode,
  sendVerificationEmail,
  sendQuillaBuilderEmail,
  sendPasswordResetEmail,
  sendAdminLoginOtpEmail,
  verifyConnection,
  verifySmtpStatus,
};
