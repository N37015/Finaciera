'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

export default function SolicitarPrestamoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);

    try {
      await fetchAPI('/prestamos/simular', {
        method: 'POST',
        body: JSON.stringify({
          idUsuario: usuario.idUsuario,
          monto: parseFloat(formData.monto),
          meses: parseInt(formData.meses),
          curp: formData.curp.toUpperCase()
        }),
      });

      alert('¡Solicitud enviada a revisión!\nEl equipo de Backoffice evaluará tus documentos.');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Solicitar Préstamo</h2>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← Volver al Panel
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto Solicitado ($)</label>
              <input
                type="number"
                name="monto"
                min="500"
                step="100"
                value={formData.monto}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej. 10000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (Meses)</label>
              <select
                name="meses"
                value={formData.meses}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="6">6 Meses</option>
                <option value="12">12 Meses</option>
                <option value="24">24 Meses</option>
                <option value="36">36 Meses</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CURP</label>
            <input
              type="text"
              name="curp"
              value={formData.curp}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="Ingresa tu CURP (18 caracteres)"
              maxLength={18}
              required
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">Validación de Identidad</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Foto de Credencial (INE)</label>
              <input 
                type="file"
                name="ine"
                accept="image/png, image/jpeg, application/pdf"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Comprobante de Domicilio (Luz/Agua)</label>
              <input 
                type="file"
                name="reciboLuzAgua"
                accept="image/png, image/jpeg, application/pdf"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? 'Procesando...' : 'Enviar Solicitud a Revisión'}
          </button>
        </form>
      </div>
    </div>
  );
}