import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900 antialiased">
        
        {/* CONTENIDO PRINCIPAL (Sin header fijo global para que no choque en los dashboards) */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>

        {/* FOOTER GLOBAL */}
        <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm border-t border-slate-800">
          <p>&copy; {new Date().getFullYear()} NovaFintech. Todos los derechos reservados.</p>
        </footer>

      </body>
    </html>
  );
}