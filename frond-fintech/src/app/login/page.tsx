'use client'; // Necesario porque usamos estado (useState) y formularios en el cliente

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0F2B52] focus:ring-2 focus:ring-[#0F2B52]/20 disabled:bg-slate-100 disabled:text-slate-500';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Guardamos el token y los datos del usuario
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('usuario', JSON.stringify(data));

      // Redirección según el rol
      if (data.rol === 'ADMIN') {
        router.replace('/dashboard/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'No pudimos iniciar sesión. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F6FB]">
      {/* Barra superior: logo y volver al inicio */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B52] text-sm font-bold text-white">
              N
            </span>
            NovaFintech
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeftIcon />
            <span>
              Volver<span className="hidden sm:inline"> al inicio</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Entra a tu cuenta para ver tus préstamos y tus pagos.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="tu@correo.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-800"
                >
                  <EyeIcon off={verPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-[#0F2B52] font-semibold text-white hover:bg-[#1B4079] disabled:bg-slate-400"
            >
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-semibold text-[#0F2B52] hover:underline">
              Regístrate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}