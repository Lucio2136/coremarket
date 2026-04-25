import { ShieldCheck } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Responsable del tratamiento",
    body: `Lucebase (en adelante "nosotros" o "la Plataforma") es responsable del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, vigentes en los Estados Unidos Mexicanos.\n\nDatos del Responsable:\nNombre o razón social: Lucebase\nDomicilio: Culiacán, Sinaloa, México\nCorreo electrónico: contacto@lucebase.mx`,
  },
  {
    title: "2. Datos personales que recopilamos",
    body: `Recopilamos las siguientes categorías de datos: (a) Datos de identificación: nombre de usuario, dirección de correo electrónico; (b) Datos de autenticación: contraseña en formato hash (nunca en texto plano), proveedor de inicio de sesión (Google si aplica); (c) Datos de transacciones: montos depositados, apostados y retirados, historial de predicciones; (d) Datos técnicos: dirección IP, tipo de dispositivo, navegador, sistema operativo, páginas visitadas y duración de sesión; (e) Comunicaciones: mensajes que nos envíes por correo electrónico o a través de la Plataforma.`,
  },
  {
    title: "3. Finalidades del tratamiento",
    body: `Tratamos tus datos personales para: (a) Finalidades primarias: crear y gestionar tu cuenta, procesar depósitos y retiros, resolver mercados y acreditar ganancias, enviarte notificaciones sobre tus predicciones, verificar tu identidad cuando sea necesario, y cumplir obligaciones legales y fiscales; (b) Finalidades secundarias (requieren tu consentimiento): enviarte comunicaciones de marketing sobre nuevas funcionalidades o promociones. Puedes retirar tu consentimiento para finalidades secundarias en cualquier momento escribiendo a contacto@lucebase.mx.`,
  },
  {
    title: "4. Procesamiento de pagos — Conekta",
    body: `Los pagos en Lucebase son procesados por Conekta, S.A. de C.V., empresa mexicana certificada y regulada conforme a la normativa de la Comisión Nacional Bancaria y de Valores (CNBV). Lucebase nunca almacena datos de tarjetas bancarias, números de cuenta ni información financiera sensible. Conekta procesa estos datos bajo sus propias políticas de privacidad y seguridad. Para más información consulta conekta.com.`,
  },
  {
    title: "5. Infraestructura — Supabase",
    body: `Almacenamos tus datos en Supabase, plataforma de base de datos en la nube que opera sobre infraestructura de Amazon Web Services (AWS). Todos los datos se transmiten cifrados mediante TLS 1.2 o superior y se almacenan con cifrado en reposo AES-256. Implementamos Row Level Security (RLS) en nuestra base de datos para garantizar que únicamente tú puedas acceder a tus datos personales y de transacciones.`,
  },
  {
    title: "6. Autenticación con Google",
    body: `Si eliges iniciar sesión con Google, tu autenticación es gestionada por los servidores de Google LLC conforme a sus propias políticas de privacidad. Lucebase únicamente recibe tu dirección de correo electrónico y nombre de perfil público de Google con tu autorización explícita. No recibimos ni almacenamos tu contraseña de Google. Puedes revocar el acceso de Lucebase a tu cuenta de Google en cualquier momento desde la configuración de tu cuenta de Google.`,
  },
  {
    title: "7. Compartir datos con terceros",
    body: `No vendemos, rentamos ni cedemos tus datos personales a terceros con fines comerciales. Únicamente compartimos información con: (a) Proveedores de servicios esenciales para operar la Plataforma (Conekta para pagos, Supabase para base de datos, Google para autenticación); (b) Autoridades competentes (SAT, PGR, CNBV u otras) cuando lo exija una ley, reglamento o resolución judicial; (c) En caso de fusión, adquisición o reestructuración empresarial, con aviso previo por correo electrónico.`,
  },
  {
    title: "8. Cookies y tecnologías de rastreo",
    body: `Usamos únicamente cookies técnicas esenciales para mantener tu sesión activa y garantizar el funcionamiento correcto de la Plataforma. No utilizamos cookies de publicidad, seguimiento de comportamiento ni rastreo por terceros. No compartimos datos de navegación con redes publicitarias. Puedes configurar tu navegador para rechazar cookies, aunque esto puede impedir el funcionamiento correcto del inicio de sesión.`,
  },
  {
    title: "9. Retención de datos",
    body: `Conservamos tus datos personales mientras tu cuenta esté activa o sea necesario para prestarte el servicio. Si solicitas la cancelación de tu cuenta, eliminamos tus datos identificativos en un plazo máximo de 30 días naturales. Los registros de transacciones financieras se conservan durante 5 años contados a partir de cada operación, conforme al artículo 30 del Código Fiscal de la Federación. Los datos anonimizados o agregados pueden conservarse indefinidamente para fines estadísticos.`,
  },
  {
    title: "10. Derechos ARCO y limitación de uso",
    body: `Conforme a la LFPDPPP tienes derecho a:\n\n(A) Acceso — conocer qué datos personales tenemos sobre ti y cómo los tratamos.\n(R) Rectificación — solicitar la corrección de datos inexactos o incompletos.\n(C) Cancelación — solicitar la eliminación de tus datos cuando ya no sean necesarios para la finalidad que motivó su recabación.\n(O) Oposición — oponerte al tratamiento de tus datos para finalidades secundarias o cuando exista un motivo legítimo.\n(L) Limitación de uso o divulgación — solicitar que suspendamos temporalmente el tratamiento de tus datos o que no los compartamos con terceros mientras resolvemos una disputa.\n\nPara ejercer cualquiera de estos derechos envía un correo a privacidad@lucebase.mx indicando: tu nombre de usuario, el derecho que deseas ejercer y los datos a los que se refiere tu solicitud. Responderemos en un plazo máximo de 20 días hábiles.\n\nSi consideras que tu solicitud no fue atendida correctamente puedes acudir al Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI): www.inai.org.mx.`,
  },
  {
    title: "11. Seguridad de la información",
    body: `Implementamos medidas técnicas, administrativas y físicas para proteger tus datos personales, que incluyen: cifrado TLS en todas las comunicaciones entre tu dispositivo y nuestros servidores; almacenamiento de contraseñas mediante algoritmo bcrypt con salt; Row Level Security en la base de datos que impide el acceso cruzado entre cuentas; acceso restringido a datos de producción solo para personal autorizado; y monitoreo continuo de accesos inusuales. Sin embargo, ningún sistema es completamente infalible; te recomendamos usar una contraseña única y activar la verificación en dos pasos cuando esté disponible.`,
  },
  {
    title: "12. Menores de edad",
    body: `Lucebase no está dirigida a personas menores de 18 años y no recopilamos conscientemente datos personales de menores. Si tienes conocimiento de que un menor ha creado una cuenta en nuestra Plataforma, notifícanos a contacto@lucebase.mx y eliminaremos la cuenta de inmediato junto con todos los datos asociados.`,
  },
  {
    title: "13. Transferencias internacionales",
    body: `Algunos de nuestros proveedores de servicios (Supabase/AWS, Google) operan en servidores ubicados fuera de México, principalmente en Estados Unidos. Estas transferencias se realizan conforme al artículo 37 de la LFPDPPP y los proveedores mantienen niveles de protección equivalentes o superiores a los exigidos por la ley mexicana.`,
  },
  {
    title: "14. Cambios a esta política",
    body: `Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en nuestras prácticas, en la legislación aplicable o en los servicios ofrecidos. Te notificaremos por correo electrónico y mediante un aviso destacado en la Plataforma con al menos 10 días de anticipación antes de que entren en vigor cambios materiales. El uso continuado de la Plataforma tras la entrada en vigor de los cambios constituye tu aceptación.`,
  },
  {
    title: "15. Oficial de Privacidad (LFPDPPP art. 30)",
    body: `Conforme al artículo 30 de la LFPDPPP, Lucebase ha designado un Oficial de Privacidad responsable de promover la protección de datos personales al interior de la organización, atender solicitudes de los titulares y supervisar el cumplimiento de las políticas de privacidad.\n\nOficial de Privacidad: Irving Omar Lizárraga Castillo\nCorreo: privacidad@lucebase.mx\nDomicilio: Culiacán, Sinaloa, México\nHorario de atención: Lunes a viernes, 9:00 – 18:00 hrs (hora del Centro de México)\n\nPara solicitudes ARCO, reportes de incidentes de seguridad o cualquier consulta sobre el tratamiento de tus datos personales, escríbenos a privacidad@lucebase.mx. Responderemos en un plazo máximo de 5 días hábiles para consultas generales y 20 días hábiles para solicitudes ARCO formales.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <ShieldCheck size={13} className="text-emerald-600" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Legal</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ letterSpacing: "-0.025em" }}>
          Política de Privacidad
        </h1>
        <p className="text-[13px] text-gray-400">Última actualización: abril 2026 · Lucebase</p>
      </div>

      {/* Intro */}
      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
        <p className="text-[12.5px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
          Tu privacidad es importante para nosotros. Esta política describe qué datos personales recopilamos, con qué finalidad, cómo los protegemos y cuáles son tus derechos conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
        </p>
      </div>

      {/* Secciones */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1117] divide-y divide-gray-100 dark:divide-gray-800">
        {SECTIONS.map((s) => (
          <div key={s.title} className="px-6 py-5">
            <h2 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100 mb-2">{s.title}</h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-gray-400 text-center">
        ¿Tienes preguntas sobre tu privacidad?{" "}
        <a href="mailto:contacto@lucebase.mx" className="text-emerald-600 hover:underline font-medium">
          contacto@lucebase.mx
        </a>
      </p>
    </div>
  );
}
