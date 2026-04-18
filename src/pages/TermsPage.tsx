import { Scale } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Aceptación de los términos",
    body: `Al acceder, registrarte o usar Coremarket (en adelante "la Plataforma"), aceptas estos Términos y Condiciones en su totalidad y sin reservas. Si no estás de acuerdo con alguna parte, debes abstenerte de usar la Plataforma. Coremarket se reserva el derecho de modificar estos términos en cualquier momento; los cambios entran en vigor al momento de su publicación. El uso continuado de la Plataforma tras cualquier modificación constituye tu aceptación de los nuevos términos.`,
  },
  {
    title: "2. Descripción del servicio",
    body: `Coremarket es una plataforma digital de mercados de predicción con fines de entretenimiento, operada bajo las leyes de los Estados Unidos Mexicanos. Los usuarios pueden adquirir posiciones en eventos verificables de carácter público (política, deportes, finanzas, entretenimiento, tecnología) utilizando saldo en pesos mexicanos (MXN). Coremarket no es una casa de apuestas deportivas, no está regulada por la Secretaría de Gobernación bajo la Ley Federal de Juegos y Sorteos, y no ofrece servicios financieros regulados. El saldo en la Plataforma es un medio de acceso al servicio de entretenimiento, no un instrumento de inversión.`,
  },
  {
    title: "3. Elegibilidad",
    body: `Para usar Coremarket debes: (a) tener al menos 18 años de edad cumplidos; (b) ser persona física con capacidad legal para contratar; (c) residir en una jurisdicción donde el uso de esta Plataforma sea legal. Al crear una cuenta declaras bajo protesta de decir verdad que cumples todos estos requisitos. Coremarket se reserva el derecho de solicitar documentos de identificación en cualquier momento y de suspender o cancelar cuentas que no cumplan estos criterios, sin responsabilidad de devolución del saldo en casos de fraude comprobado.`,
  },
  {
    title: "4. Registro y seguridad de la cuenta",
    body: `Al registrarte proporcionas información veraz, completa y actualizada. Eres el único responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades realizadas desde tu cuenta. Debes notificar a Coremarket de inmediato ante cualquier uso no autorizado enviando un correo a contacto@coremarket.mx. Está prohibido transferir, vender o ceder tu cuenta a terceros. Coremarket no se responsabiliza por pérdidas derivadas del acceso no autorizado a tu cuenta por causas imputables al usuario.`,
  },
  {
    title: "5. Depósitos",
    body: `Los depósitos se procesan a través de Conekta, procesador de pagos certificado conforme a la normativa mexicana. Aceptamos tarjeta de crédito/débito (Visa, Mastercard, American Express), pagos en efectivo vía OXXO Pay y transferencias SPEI. El monto mínimo de depósito es de $100 MXN. Los fondos se acreditan en tu saldo de Coremarket una vez confirmado el pago por Conekta, lo cual puede tomar entre minutos (tarjeta/SPEI) y 24 horas (OXXO). Coremarket no almacena datos de tarjetas bancarias.`,
  },
  {
    title: "6. Retiros",
    body: `Los retiros de saldo están disponibles para usuarios con cuenta verificada. El monto mínimo de retiro es de $200 MXN. Las solicitudes se procesan en 1 a 5 días hábiles mediante transferencia bancaria SPEI a la cuenta registrada a nombre del titular. Coremarket puede solicitar documentos de verificación de identidad (INE/pasaporte) antes de procesar el primer retiro o ante movimientos inusuales. El retiro de fondos producto de actividad fraudulenta está prohibido y puede resultar en acciones legales.`,
  },
  {
    title: "7. Comisiones y tarifas",
    body: `Coremarket aplica una comisión de plataforma del 3% sobre el monto neto pagado a los ganadores de cada mercado. Esta comisión se deduce automáticamente al momento de la resolución del mercado. No se cobran comisiones por depósito. Los retiros son gratuitos. Las tarifas de procesamiento de Conekta (cuando apliquen) corren por cuenta de Coremarket y no se trasladan al usuario. Coremarket se reserva el derecho de modificar su estructura de comisiones con aviso previo de 15 días naturales.`,
  },
  {
    title: "8. Resolución de mercados",
    body: `Los mercados se resuelven por el equipo editorial de Coremarket utilizando fuentes públicas, verificables e independientes (medios de comunicación reconocidos, fuentes oficiales, registros públicos). El resultado se publica junto con la fuente de verificación. Si un evento no puede verificarse de forma concluyente dentro del plazo establecido, el mercado se declara nulo y se reembolsa íntegramente el saldo apostado a todos los participantes sin deducción alguna. La resolución del equipo editorial es definitiva e inapelable.`,
  },
  {
    title: "9. Conducta prohibida",
    body: `Está estrictamente prohibido: (a) manipular precios de mercado mediante acuerdos con otros usuarios ("wash trading"); (b) crear múltiples cuentas para explotar bonos o promociones; (c) usar scripts, bots o automatización no autorizada; (d) suplantar la identidad de otra persona; (e) publicar contenido difamatorio, obsceno o ilegal; (f) lavar dinero o usar la Plataforma para actividades ilícitas; (g) intentar hackear, comprometer o interrumpir los servidores de la Plataforma. La violación de cualquiera de estas prohibiciones puede resultar en suspensión permanente, retención del saldo y denuncia ante las autoridades competentes.`,
  },
  {
    title: "10. Limitación de responsabilidad",
    body: `Coremarket no garantiza ganancias. La participación en mercados de predicción es de naturaleza especulativa y conlleva el riesgo de perder la totalidad del saldo invertido. La Plataforma se ofrece "tal cual" y "según disponibilidad", sin garantías de funcionamiento ininterrumpido. En la máxima medida permitida por la ley mexicana, Coremarket no será responsable por: pérdidas de saldo no atribuibles directamente a un error de la Plataforma, interrupciones del servicio, errores de terceros (procesadores de pago, proveedores de infraestructura) ni decisiones de predicción tomadas por el usuario.`,
  },
  {
    title: "11. Propiedad intelectual",
    body: `Todos los elementos de Coremarket — incluyendo sin limitación: diseño visual, interfaz, código fuente, marca, logotipos, nombre comercial, textos y datos — son propiedad exclusiva de Coremarket o de sus licenciantes y están protegidos por las leyes de propiedad intelectual de México y tratados internacionales. Queda prohibida su reproducción, distribución, modificación o uso comercial sin autorización escrita previa. El usuario recibe únicamente una licencia limitada, personal, no transferible y revocable para acceder y usar la Plataforma conforme a estos términos.`,
  },
  {
    title: "12. Protección de datos personales",
    body: `El tratamiento de tus datos personales se rige por nuestra Política de Privacidad y por la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento. Puedes consultar nuestra Política de Privacidad en /privacy. Para ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) escríbenos a contacto@coremarket.mx.`,
  },
  {
    title: "13. Modificaciones al servicio",
    body: `Coremarket se reserva el derecho de modificar, suspender o descontinuar cualquier parte de la Plataforma en cualquier momento, con o sin previo aviso, sin incurrir en responsabilidad ante el usuario. En caso de cierre definitivo de la Plataforma, notificaremos a los usuarios con al menos 30 días de anticipación y habilitaremos el retiro de saldos disponibles.`,
  },
  {
    title: "14. Ley aplicable y jurisdicción",
    body: `Estos Términos y Condiciones se rigen e interpretan conforme a las leyes vigentes de los Estados Unidos Mexicanos. Para la resolución de cualquier controversia derivada de estos términos o del uso de la Plataforma, las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando expresamente a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.`,
  },
  {
    title: "15. Contacto",
    body: `Para cualquier pregunta, duda o reclamación relacionada con estos Términos y Condiciones, contáctanos en: contacto@coremarket.mx. Tiempo de respuesta: máximo 5 días hábiles.`,
  },
];

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Scale size={13} className="text-blue-600" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Legal</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ letterSpacing: "-0.025em" }}>
          Términos y Condiciones
        </h1>
        <p className="text-[13px] text-gray-400">Última actualización: abril 2026 · Coremarket</p>
      </div>

      {/* Intro */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
        <p className="text-[12.5px] text-blue-700 dark:text-blue-300 leading-relaxed">
          Lee estos términos detenidamente antes de usar la plataforma. Al registrarte o usar Coremarket aceptas quedar vinculado por estas condiciones en su totalidad.
        </p>
      </div>

      {/* Secciones */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1117] divide-y divide-gray-100 dark:divide-gray-800">
        {SECTIONS.map((s) => (
          <div key={s.title} className="px-6 py-5">
            <h2 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100 mb-2">{s.title}</h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-gray-400 text-center">
        ¿Tienes preguntas?{" "}
        <a href="mailto:contacto@coremarket.mx" className="text-blue-600 hover:underline font-medium">
          contacto@coremarket.mx
        </a>
      </p>
    </div>
  );
}
