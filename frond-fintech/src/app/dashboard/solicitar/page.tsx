'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

export default function SolicitarPrestamoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const [formData, setFormData] = useState({
    monto: '',
    meses: '12',
    curp: '',
    ine: '',
    reciboLuzAgua: '',
    comprobanteIngresos: 'Pendiente',
    estadoCuenta: 'Pendiente'
  });

  useEffect(() => {
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.push('/login');
    } else {
      setUsuario(JSON.parse(userData));
    }
  }, [router]);

  // Tras el éxito, esperamos 2.5 s para que el cliente lea el aviso y lo mandamos al panel
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => router.push('/dashboard'), 2500);
    return () => clearTimeout(t);
  }, [exito, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, [e.target.name]: `http://localhost:8080/documentos/${e.target.files[0].name}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!usuario) {
      setError('Tu sesión no está lista. Recarga la página e intenta de nuevo.');
      return;
    }

    const curp = formData.curp.trim().toUpperCase();
    if (!CURP_REGEX.test(curp)) {
      setError('El CURP no tiene un formato válido. Revisa que sean 18 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await fetchAPI('/prestamos/simular', {
        method: 'POST',
        body: JSON.stringify({
          idUsuario: usuario.idUsuario,
          monto: parseFloat(formData.monto),
          meses: parseInt(formData.meses),
          curp
        }),
      });

      setExito(true);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-6 sm:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Solicitar Préstamo</h2>
          <Link href="/dashboard" className="text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors">
            ← Volver al Panel
          </Link>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-xs sm:text-sm">
            {error}
          </div>
        )}

        {exito && (
          <div role="status" className="bg-green-50 text-green-700 p-3 rounded-lg mb-6 text-xs sm:text-sm">
            <p className="font-semibold">¡Solicitud enviada a revisión!</p>
            <p className="mt-1">El equipo de Backoffice evaluará tus documentos. Te llevamos a tu panel...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Se adapta de 2 columnas en pantallas medianas/grandes a 1 columna en celulares */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="monto" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Monto Solicitado ($)</label>
              <input
                id="monto"
                type="number"
                name="monto"
                min="500"
                step="100"
                value={formData.monto}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Ej. 10000"
                required
                disabled={loading || exito}
              />
            </div>
            <div>
              <label htmlFor="meses" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Plazo (Meses)</label>
              <select
                id="meses"
                name="meses"
                value={formData.meses}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                disabled={loading || exito}
              >
                <option value="6">6 Meses</option>
                <option value="12">12 Meses</option>
                <option value="24">24 Meses</option>
                <option value="36">36 Meses</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="curp" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">CURP</label>
            <input
              id="curp"
              type="text"
              name="curp"
              value={formData.curp}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 uppercase text-sm"
              placeholder="Ingresa tu CURP (18 caracteres)"
              maxLength={18}
              required
              disabled={loading || exito}
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-700">Validación de Identidad</h3>

            <div>
              <label htmlFor="ine" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">Foto de Credencial (INE)</label>
              <input
                id="ine"
                type="file"
                name="ine"
                accept="image/png, image/jpeg, application/pdf"
                onChange={handleFileChange}
                className="w-full text-xs sm:text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                disabled={loading || exito}
              />
            </div>

            <div>
            <label htmlFor="reciboLuzAgua" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">
              Comprobante de Domicilio (Luz/Agua) <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="reciboLuzAgua"
              type="file"
              name="reciboLuzAgua"
              accept="image/png, image/jpeg, application/pdf"
              onChange={handleFileChange}
              className="w-full text-xs sm:text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              disabled={loading || exito}
            />
          </div>
          </div>

          <button
            type="submit"
            disabled={loading || exito}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 text-sm sm:text-base shadow-sm"
          >
            {loading ? 'Procesando...' : exito ? 'Solicitud enviada' : 'Enviar Solicitud a Revisión'}
          </button>
        </form>
      </div>
    </div>
  );
}