"use client";

import { useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------
    ICONOS EN SVG (sin dependencias externas)
------------------------------------------------------------------- */
type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChevronDown({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

function FileText({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </Icon>
  );
}

function Landmark({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 21h18" />
    </Icon>
  );
}

function ShieldCheck({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

/* ------------------------------------------------------------------
    CONSTANTES Y REGLAS DE NEGOCIO (Igual al backend)
------------------------------------------------------------------- */
const MONTO_MIN = 500;
const MONTO_MAX = 50000;

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function calcularPrestamo(monto: number, meses: number) {
  let tasa = 15.5;
  if (meses === 6) tasa = 10.5;
  else if (meses === 12) tasa = 15.5;
  else if (meses === 24) tasa = 25.0;
  else if (meses === 36) tasa = 35.5;

  const total = monto + (monto * (tasa / 100));
  const pagoMensual = total / meses;

  return { pagoMensual, total, tasa };
}

const PASOS = [
  {
    titulo: "Crea tu cuenta y solicita",
    texto: "Elige monto y plazo, y llena la solicitud. Toma unos minutos.",
  },
  {
    titulo: "Sube tu identificación",
    texto: "Adjunta tus documentos desde el celular o la computadora.",
  },
  {
    titulo: "Espera la revisión",
    texto:
      "Nuestro equipo revisa tu solicitud y te avisa el resultado en la plataforma.",
  },
  {
    titulo: "Paga por SPEI",
    texto:
      "Si te aprobamos, recibes una CLABE propia para tu préstamo. Cada abono se refleja en tu saldo.",
  },
];

const PREGUNTAS = [
  {
    p: "¿Qué documentos necesito?",
    r: "Una identificación oficial vigente y los datos que te pedimos en la solicitud. Si hace falta algo más, te lo indicamos en tu cuenta.",
  },
  {
    p: "¿Cuánto tarda la revisión?",
    r: "Depende de que tus documentos estén completos y legibles. Verás el estado de tu solicitud en tu cuenta en todo momento.",
  },
  {
    p: "¿Cómo pago mi préstamo?",
    r: "Con transferencias SPEI a la CLABE que se genera al aprobar tu préstamo. Puedes hacerlo desde la app de tu banco.",
  },
  {
    p: "¿Qué pasa si me atraso en un pago?",
    r: "Revisa las condiciones de tu contrato. Si prevés un retraso, escríbenos antes de la fecha de pago para buscar una solución.",
  },
];

/* ------------------------------------------------------------------
    COMPONENTE: SIMULADOR CON RANGE SLIDER
------------------------------------------------------------------- */
function Simulador() {
  const [monto, setMonto] = useState(10000);
  const [meses, setMeses] = useState(12);

  const { pagoMensual, total, tasa } = calcularPrestamo(monto, meses);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">
        Simula tu préstamo
      </h2>

      <div className="mt-6 space-y-6">
        {/* MONTO CON SLIDER */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="monto-range" className="text-sm font-medium text-slate-700">
              Monto solicitado
            </label>
            <span className="text-xl font-bold tabular-nums text-[#0F2B52]">
              {money.format(monto)}
            </span>
          </div>

          <input
            id="monto-range"
            type="range"
            min={MONTO_MIN}
            max={MONTO_MAX}
            step={500}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            className="w-full accent-[#0F2B52] cursor-pointer h-2 bg-slate-200 rounded-lg"
          />

          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{money.format(MONTO_MIN)}</span>
            <span>{money.format(MONTO_MAX)}</span>
          </div>
        </div>

        {/* PLAZO EN BOTONES / SELECTOR */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Plazo de pago
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[6, 12, 24, 36].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeses(m)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  meses === m
                    ? "bg-[#0F2B52] text-white shadow"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {m} meses
              </button>
            ))}
          </div>
        </div>
      </div>

      <dl className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-slate-600">Pago mensual aproximado</dt>
          <dd className="text-3xl font-semibold tabular-nums text-[#0F2B52]">
            {money.format(pagoMensual)}
          </dd>
        </div>
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <dt className="text-slate-600">Total a pagar</dt>
          <dd className="tabular-nums text-slate-900">{money.format(total)}</dd>
        </div>
      </dl>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Cálculo con tasa de interés fija del {tasa}%. El monto final depende de la aprobación de tu solicitud y de las condiciones de tu contrato.
      </p>

      <div className="mt-6">
        <Link
          href="/registro"
          className="flex h-11 w-full items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-semibold text-white hover:bg-[#1B4079]"
        >
          Solicitar este préstamo
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
    COMPONENTE PRINCIPAL: HOME
------------------------------------------------------------------- */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col w-full bg-white text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-bold text-white">
              N
            </span>
            NovaFintech
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/login" className="text-slate-700 hover:text-slate-900">
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-[#0F2B52] px-4 py-2 text-white hover:bg-[#1B4079]"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Pide un préstamo de {money.format(MONTO_MIN)} a{" "}
            {money.format(MONTO_MAX)} y págalo por SPEI
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
            Solicita en línea, sube tu identificación y sigue el estado de tu
            préstamo y tus pagos desde tu cuenta.
          </p>
          <div className="mt-8">
            <Link
              href="/registro"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[#0F2B52] px-7 text-sm font-semibold text-white hover:bg-[#1B4079]"
            >
              Solicitar mi préstamo
            </Link>
          </div>
        </div>

        <Simulador />
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="border-t border-slate-200 bg-[#F2F6FB] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight">
            Así funciona, de la solicitud al primer pago
          </h2>

          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="border-t-2 border-[#0F2B52] pt-4">
                <span className="text-sm font-medium text-[#0F2B52]">
                  Paso {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {paso.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {paso.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LO QUE TIENES EN TU CUENTA */}
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="max-w-sm text-3xl font-semibold tracking-tight">
            Todo tu préstamo en un solo lugar
          </h2>

          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            <li className="flex gap-4 py-6">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-[#0F2B52]" />
              <div>
                <h3 className="font-semibold">Estado de tu solicitud</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Consulta si tu solicitud está en revisión, aprobada o si
                  necesitamos algún documento más.
                </p>
              </div>
            </li>
            <li className="flex gap-4 py-6">
              <Landmark className="mt-1 h-5 w-5 shrink-0 text-[#0F2B52]" />
              <div>
                <h3 className="font-semibold">CLABE para tus pagos</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Cada préstamo aprobado tiene su propia CLABE. Tu saldo se
                  actualiza cuando recibimos el abono.
                </p>
              </div>
            </li>
            <li className="flex gap-4 py-6">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#0F2B52]" />
              <div>
                <h3 className="font-semibold">Historial de movimientos</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Revisa cada pago y cada cargo de tu préstamo cuando lo
                  necesites. Tus datos y documentos viajan cifrados.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* CIERRE */}
      <section className="py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center">
          <h2 className="max-w-md text-2xl font-semibold tracking-tight">
            ¿Ya sabes cuánto necesitas?
          </h2>
          <Link
            href="/registro"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#0F2B52] px-7 text-sm font-semibold text-white hover:bg-[#1B4079]"
          >
            Solicitar mi préstamo
          </Link>
        </div>
      </section>
    </div>
  );
}