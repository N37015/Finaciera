import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center w-full max-w-5xl mx-auto px-6 py-20 text-center">
      
      <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl mb-6">
        Bienvenido a <span className="text-blue-600">NovaFintech</span>
      </h1>
      
      <p className="max-w-2xl text-lg leading-8 text-slate-600 mb-10">
        Tu plataforma financiera de confianza. Gestiona tus préstamos, realiza abonos por SPEI y mantén un historial claro de tus transacciones desde un solo lugar.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/login"
          className="flex h-12 items-center justify-center rounded bg-blue-600 px-8 text-sm font-semibold text-white transition-colors hover:bg-blue-700 shadow-sm"
        >
          Ingresar a mi cuenta
        </Link>
        <Link
          href="/registro"
          className="flex h-12 items-center justify-center rounded border border-slate-300 bg-white px-8 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 shadow-sm"
        >
          Crear una cuenta
        </Link>
      </div>

    </div>
  );
}