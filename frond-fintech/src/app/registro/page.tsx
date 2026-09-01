'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Llamamos a tu endpoint de C# que está en el puerto 8080
      await fetchAPI('/registro', {
        method: 'POST',
        body: JSON.stringify({ nombre, email, password }),
      });

      setExito(true);
      
      // Esperamos 2 segundos y lo mandamos al login
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Crear Cuenta</h1>
          <p className="text-slate-500 mt-2">Únete a NovaFintech hoy mismo</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {exito && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-6 text-sm text-center">
            ¡Usuario creado con éxito! Redirigiendo al login...
          </div>
        )}

        <form onSubmit={handleRegistro} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Ej. Juan Pérez"
              required
              disabled={loading || exito}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="tu@email.com"
              required
              disabled={loading || exito}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              required
              disabled={loading || exito}
            />
          </div>

          <button
            type="submit"
            disabled={loading || exito}
            className="w-full bg-slate-800 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400"
          >
            {loading ? 'Registrando...' : 'Registrarme'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta? <a href="/login" className="text-blue-600 font-semibold hover:underline">Inicia sesión</a>
        </div>
      </div>
    </div>
  );
}