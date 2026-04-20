/**
 * ============================================
 * RutaQuilla - Páginas Legales
 * ============================================
 * 
 * Modal fullscreen con Política de Privacidad y
 * Términos y Condiciones basados en la Ley 1581
 * de 2012 (Habeas Data) de Colombia.
 */

import { X, Shield, FileText, ChevronLeft } from 'lucide-react';

function PrivacyContent() {
  return (
    <div style={{ lineHeight: 1.8, color: '#CBD5E1' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))',
          border: '1px solid rgba(6,182,212,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={22} color="#06B6D4" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            Política de Privacidad
          </h2>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
            Última actualización: Abril 2026
          </p>
        </div>
      </div>

      <Section title="1. Responsable del Tratamiento de Datos">
        <p>
          <strong>RutaQuilla</strong> es una plataforma de información de transporte público
          en Barranquilla, Colombia. El responsable del tratamiento de los datos personales
          recopilados a través de esta plataforma es el equipo de desarrollo de RutaQuilla.
        </p>
        <p>
          Correo de contacto para asuntos de privacidad:{' '}
          <span style={{ color: '#06B6D4' }}>privacidad@rutaquilla.me</span>
        </p>
      </Section>

      <Section title="2. Marco Legal">
        <p>
          Esta política se rige por la <strong>Ley 1581 de 2012</strong> (Ley de Protección
          de Datos Personales de Colombia), el <strong>Decreto 1377 de 2013</strong>, y demás
          normatividad vigente en materia de protección de datos personales en la
          República de Colombia.
        </p>
      </Section>

      <Section title="3. Datos que Recopilamos">
        <p>Recopilamos los siguientes datos personales con su autorización expresa:</p>
        <ul>
          <li><strong>Datos de registro:</strong> Nombre completo, correo electrónico y contraseña (almacenada de forma encriptada con bcrypt).</li>
          <li><strong>Datos de ubicación:</strong> Coordenadas GPS cuando usted autoriza el acceso a su ubicación para buscar rutas cercanas. Estos datos se procesan en tiempo real y <strong>no se almacenan</strong> en nuestros servidores.</li>
          <li><strong>Datos de uso:</strong> Búsquedas de rutas realizadas, para mejorar las recomendaciones del servicio.</li>
          <li><strong>Datos técnicos:</strong> Dirección IP, tipo de navegador y dispositivo, únicamente para fines de seguridad y rendimiento.</li>
        </ul>
      </Section>

      <Section title="4. Finalidad del Tratamiento">
        <p>Sus datos personales serán utilizados para:</p>
        <ul>
          <li>Prestar el servicio de búsqueda y navegación de rutas de transporte público.</li>
          <li>Gestionar su cuenta de usuario y autenticación.</li>
          <li>Mejorar la calidad y experiencia del servicio.</li>
          <li>Enviar comunicaciones relacionadas con el servicio (solo si las autoriza).</li>
          <li>Garantizar la seguridad de la plataforma mediante el rate limiting y detección de abuso.</li>
        </ul>
      </Section>

      <Section title="5. Derechos del Titular (Derechos ARCO)">
        <p>
          Conforme a la Ley 1581 de 2012, usted tiene derecho a:
        </p>
        <ul>
          <li><strong>Acceso:</strong> Conocer qué datos personales tenemos sobre usted.</li>
          <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos.</li>
          <li><strong>Cancelación:</strong> Solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
          <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos para fines específicos.</li>
        </ul>
        <p>
          Para ejercer estos derechos, envíe un correo a{' '}
          <span style={{ color: '#06B6D4' }}>privacidad@rutaquilla.me</span>{' '}
          con el asunto "Solicitud de Datos Personales" indicando su nombre
          completo y el derecho que desea ejercer.
        </p>
      </Section>

      <Section title="6. Seguridad de los Datos">
        <p>
          Implementamos medidas técnicas y organizativas para proteger sus datos personales:
        </p>
        <ul>
          <li>Contraseñas encriptadas con <strong>bcrypt</strong> (12 rondas de salt).</li>
          <li>Comunicaciones protegidas con <strong>HTTPS/TLS</strong>.</li>
          <li>Tokens de sesión <strong>JWT</strong> con expiración automática.</li>
          <li>Rate limiting para prevenir ataques de fuerza bruta.</li>
          <li>Headers de seguridad HTTP configurados con Helmet.js.</li>
          <li>Base de datos alojada en <strong>MongoDB Atlas</strong> con encriptación en reposo.</li>
        </ul>
      </Section>

      <Section title="7. Cookies y Almacenamiento Local">
        <p>
          RutaQuilla utiliza <strong>localStorage</strong> del navegador (no cookies de terceros) para:
        </p>
        <ul>
          <li>Almacenar su token de sesión (autenticación).</li>
          <li>Guardar su preferencia de consentimiento de cookies.</li>
          <li>Mantener el contador de búsquedas gratuitas.</li>
        </ul>
        <p>
          No utilizamos cookies de rastreo ni compartimos datos con terceros
          para fines publicitarios.
        </p>
      </Section>

      <Section title="8. Transferencia Internacional de Datos">
        <p>
          Sus datos pueden ser almacenados en servidores ubicados fuera de Colombia
          (MongoDB Atlas en AWS us-east-1, DigitalOcean). Estas transferencias
          se realizan con las garantías adecuadas de protección conforme a la
          normatividad colombiana.
        </p>
      </Section>

      <Section title="9. Vigencia y Modificaciones">
        <p>
          Esta política entra en vigencia a partir de su publicación y podrá ser
          actualizada periódicamente. Los cambios significativos serán notificados
          a través de la plataforma.
        </p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div style={{ lineHeight: 1.8, color: '#CBD5E1' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={22} color="#F59E0B" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            Términos y Condiciones
          </h2>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
            Última actualización: Abril 2026
          </p>
        </div>
      </div>

      <Section title="1. Aceptación de los Términos">
        <p>
          Al acceder y utilizar la plataforma RutaQuilla, usted acepta estos
          Términos y Condiciones en su totalidad. Si no está de acuerdo con
          alguna parte de estos términos, le solicitamos no utilizar el servicio.
        </p>
      </Section>

      <Section title="2. Descripción del Servicio">
        <p>
          RutaQuilla es una plataforma de información de transporte público para
          la ciudad de Barranquilla, Colombia. El servicio incluye:
        </p>
        <ul>
          <li>Búsqueda de rutas de bus entre dos puntos de la ciudad.</li>
          <li>Visualización de recorridos de rutas en un mapa interactivo.</li>
          <li>Información de puntos de interés cercanos a las rutas.</li>
          <li>Estimación de tiempos y distancias de viaje.</li>
        </ul>
      </Section>

      <Section title="3. Registro y Cuenta de Usuario">
        <p>
          El acceso básico a RutaQuilla permite <strong>3 búsquedas gratuitas</strong> sin
          necesidad de registro. Para acceso ilimitado, se requiere crear una cuenta
          proporcionando información veraz y actualizada.
        </p>
        <p>
          Usted es responsable de mantener la confidencialidad de su contraseña
          y de todas las actividades realizadas con su cuenta.
        </p>
      </Section>

      <Section title="4. Uso Aceptable">
        <p>Al usar RutaQuilla, usted se compromete a:</p>
        <ul>
          <li>No intentar acceder a sistemas o datos de forma no autorizada.</li>
          <li>No utilizar el servicio para actividades ilegales o fraudulentas.</li>
          <li>No sobrecargar el sistema con solicitudes automatizadas excesivas.</li>
          <li>No suplantar la identidad de otro usuario.</li>
          <li>Proporcionar información veraz al momento del registro.</li>
        </ul>
      </Section>

      <Section title="5. Limitación de Responsabilidad">
        <p>
          RutaQuilla proporciona información de transporte público con fines
          <strong> informativos y de referencia</strong>. No garantizamos:
        </p>
        <ul>
          <li>La exactitud absoluta de los horarios o recorridos de las rutas, ya que estos pueden cambiar sin previo aviso por parte de las empresas de transporte.</li>
          <li>La disponibilidad ininterrumpida del servicio.</li>
          <li>Que las estimaciones de tiempo de viaje sean exactas en todo momento.</li>
        </ul>
        <p>
          RutaQuilla no es responsable por daños directos o indirectos derivados
          del uso de la información proporcionada en la plataforma.
        </p>
      </Section>

      <Section title="6. Propiedad Intelectual">
        <p>
          El código fuente, diseño, marca, logotipos y contenido original de
          RutaQuilla están protegidos por las leyes de propiedad intelectual
          de Colombia. Los datos de mapa provienen de{' '}
          <strong>OpenStreetMap</strong> bajo licencia ODbL.
        </p>
      </Section>

      <Section title="7. Edad Mínima">
        <p>
          Para crear una cuenta en RutaQuilla, debe tener al menos
          <strong> 13 años de edad</strong>. Si es menor de 18 años, debe contar
          con la autorización de su padre, madre o tutor legal.
        </p>
      </Section>

      <Section title="8. Terminación">
        <p>
          Nos reservamos el derecho de suspender o terminar su cuenta en caso de
          violación de estos Términos y Condiciones, sin previo aviso.
        </p>
      </Section>

      <Section title="9. Legislación Aplicable">
        <p>
          Estos Términos se rigen por las leyes de la República de Colombia.
          Cualquier controversia será resuelta ante los tribunales competentes
          de la ciudad de Barranquilla, Atlántico.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontSize: 15, fontWeight: 700, color: '#F1F5F9',
        marginBottom: 8, fontFamily: 'Outfit, sans-serif',
        paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {title}
      </h3>
      <div style={{ fontSize: 13, paddingLeft: 4 }}>
        {children}
      </div>
      <style>{`
        div ul { padding-left: 20px; margin: 8px 0; }
        div li { margin-bottom: 4px; }
        div p { margin: 8px 0; }
      `}</style>
    </div>
  );
}

export default function LegalPages({ page, onClose, onNavigate }) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full h-full md:h-auto md:max-h-[85vh] animate-slide-up"
        style={{
          maxWidth: 680,
          borderRadius: window.innerWidth >= 768 ? 24 : 0,
          background: 'linear-gradient(145deg, rgba(17,24,39,0.99) 0%, rgba(11,17,32,1) 100%)',
          border: window.innerWidth >= 768 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient bar */}
        <div style={{
          height: 3, flexShrink: 0,
          background: page === 'privacy'
            ? 'linear-gradient(90deg, #06B6D4, #3B82F6, #8B5CF6)'
            : 'linear-gradient(90deg, #F59E0B, #D97706, #92400E)',
        }} />

        {/* Header */}
        <div style={{
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Toggle between privacy and terms */}
            <div style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10, padding: 3,
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <button
                onClick={() => onNavigate('privacy')}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: page === 'privacy' ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: page === 'privacy' ? '#06B6D4' : '#64748B',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Shield size={12} /> Privacidad
              </button>
              <button
                onClick={() => onNavigate('terms')}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: page === 'terms' ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: page === 'terms' ? '#F59E0B' : '#64748B',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <FileText size={12} /> Términos
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
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
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}>
          {page === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  );
}
