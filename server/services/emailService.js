/**
 * ============================================
 * RutaQuilla - Email Service (Zoho Mail)
 * ============================================
 * 
 * Servicio de envío de correos con Nodemailer + Zoho SMTP.
 * Incluye plantilla HTML profesional para verificación de cuentas.
 */

const nodemailer = require('nodemailer');

// Crear transporter con Zoho Mail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD,
  },
});

/**
 * Genera un código de verificación de 6 dígitos.
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Plantilla HTML profesional para el email de verificación.
 */
function getVerificationEmailHTML(userName, code) {
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
                Hola <strong style="color: #94A3B8;">${userName}</strong>, usa este código para completar tu registro en RutaQuilla.
              </p>

              <!-- Code box -->
              <div style="background: rgba(245,158,11,0.06); border: 2px solid rgba(245,158,11,0.2); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 8px; font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600;">
                  Tu código de verificación
                </p>
                <div style="font-size: 36px; font-weight: 800; color: #F59E0B; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(245,158,11,0.3);">
                  ${code}
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
  const mailOptions = {
    from: `"RutaQuilla" <${process.env.ZOHO_EMAIL}>`,
    to,
    subject: `🚌 Tu código de verificación: ${code} — RutaQuilla`,
    html: getVerificationEmailHTML(userName, code),
    text: `Hola ${userName}, tu código de verificación en RutaQuilla es: ${code}. Este código expira en 15 minutos.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email de verificación enviado a ${to} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    throw new Error('No se pudo enviar el email de verificación');
  }
}

/**
 * Verifica que la conexión SMTP funcione.
 */
async function verifyConnection() {
  try {
    if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_PASSWORD) {
      console.warn('⚠️ ZOHO_EMAIL o ZOHO_PASSWORD no configurados — verificación por email deshabilitada');
      return false;
    }
    await transporter.verify();
    console.log('✅ Conexión SMTP con Zoho Mail verificada');
    return true;
  } catch (error) {
    console.warn('⚠️ No se pudo conectar a Zoho SMTP:', error.message);
    return false;
  }
}

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  verifyConnection,
};
