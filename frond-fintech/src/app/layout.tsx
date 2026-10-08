import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovaFintech",
  description: "Plataforma financiera",
};

// Cambia estas URLs por tus perfiles reales
const SOCIALS = [
  {
    name: "Instagram",
    href: "https://instagram.com/tu_usuario",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://facebook.com/tu_pagina",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.5V4.3c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.5v3H10V21h3.5z" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    href: "https://github.com/tu_usuario",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
      </svg>
    ),
  },
];

const FOOTER_LINKS = [
  {
    title: "Producto",
    links: [
      { label: "Simulador de préstamos" },
      { label: "Cómo funciona" },
      { label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones" },
      { label: "Aviso de privacidad" },
      { label: "Transparencia y costos" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Contacto" },
      { label: "Atención a usuarios" },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* Sin header global para no chocar con los dashboards */}
        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="bg-[#0B1F3A] text-slate-400 border-t border-[#16345C]">
          <div className="max-w-7xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
            {/* Marca + redes */}
            <div>
              <Link href="/" className="flex items-center gap-2 text-white font-semibold text-lg">
                <span className="bg-[#2F6BCB] w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">
                  N
                </span>
                NovaFintech
              </Link>
              <p className="mt-4 text-sm leading-relaxed max-w-xs">
                Créditos y préstamos digitales con pagos por SPEI y seguimiento
                de tu saldo en tiempo real.
              </p>

              <ul className="mt-6 flex items-center gap-3">
                {SOCIALS.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2A4A78] text-slate-300 transition-colors hover:border-blue-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                      {s.icon}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Columnas de enlaces */}
            {FOOTER_LINKS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-sm font-semibold text-white">{col.title}</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>{l.label}</li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="border-t border-[#16345C]">
            <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p>&copy; {new Date().getFullYear()} NovaFintech. Todos los derechos reservados.</p>
              <p>
                Los préstamos están sujetos a aprobación. Consulta el CAT y la
                tasa de interés antes de contratar.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}