import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 w-full bg-slate-50">
      
      {/* HEADER PÚBLICO INTEGRADO */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm shadow-sm">N</span>
            NovaFintech
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium">
            <Link href="/login" className="hover:text-blue-400 transition-colors">
              Iniciar Sesión
            </Link>
            <Link
              href="/registro"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Crear una cuenta
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO SECTION PRINCIPAL */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-6 text-center max-w-5xl mx-auto flex flex-col items-center justify-center">
        {/* Destello decorativo de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs sm:text-sm font-semibold mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          Plataforma de Créditos y Préstamos Digitales
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
          Impulsa tus finanzas con <span className="text-blue-600">NovaFintech</span>
        </h1>

        <p className="max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 mb-10">
          Tu plataforma financiera de confianza. Gestiona tus créditos, simula préstamos en segundos, realiza abonos automatizados por SPEI y mantén un control absoluto de tus transacciones.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-md hover:shadow-lg"
          >
            Ingresar a mi cuenta
          </Link>
          <Link
            href="/registro"
            className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-8 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100 shadow-sm"
          >
            Crear una cuenta gratis
          </Link>
        </div>
      </section>

      {/* SECCIÓN DE CARACTERÍSTICAS / VALOR */}
      <section className="bg-white py-16 px-6 border-t border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-4">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Aprobación Ágil</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Envía tu solicitud y documentos de identidad de forma digital para una revisión rápida por parte de nuestro equipo de backoffice.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl mb-4">
              🏦
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Pagos vía SPEI</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cada préstamo aprobado genera una CLABE interbancaria única para que realices tus abonos con actualización de saldo inmediata.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xl mb-4">
              🔒
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Seguridad y Control</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Acceso protegido mediante tokens JWT y un panel transparente donde puedes revisar el historial completo de tus movimientos.
            </p>
          </div>

        </div>
      </section>

    </div>
  );
}