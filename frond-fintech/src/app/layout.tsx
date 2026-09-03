import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* Añadimos flex y flex-col para mantener el footer abajo */}
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900 antialiased">
        
        {/* HEADER BASADO EN TU DISEÑO */}
        <header className="bg-slate-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight">
              NovaFintech
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/login" className="hover:text-slate-300 transition-colors">
                Iniciar Sesión
              </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
            href="/registro"
            className="hover:text-slate-300 transition-colors"
            >
            Crear una cuenta
           </Link>

            </nav>
            
            </nav>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>

        {/* FOOTER */}
        <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm border-t border-slate-800">
          <p>&copy; {new Date().getFullYear()} NovaFintech. Todos los derechos reservados.</p>
        </footer>

      </body>
    </html>
  );
}