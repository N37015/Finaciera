'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clabeSpei, setClabeSpei] = useState('');
  const [montoSpei, setMontoSpei] = useState('');

  useEffect(() => {
    // CAMBIADO A SESSIONSTORAGE PARA EVITAR CRUCE DE SESIONES ENTRE PESTAÑAS
    const userData = sessionStorage.getItem('usuario');
    if (!userData) {
      router.push('/login');
      return;
    }

    const userObj = JSON.parse(userData);
    if (userObj.rol !== 'ADMIN') {
      alert('Acceso denegado. Esta área es solo para el equipo de Backoffice.');
      router.push('/dashboard');
      return;
    }

    cargarDatosAdmin();
  }, [router]);

  const cargarDatosAdmin = async () => {
    try {
      const dataSolicitudes = await fetchAPI('/admin/solicitudes');
      setSolicitudes(dataSolicitudes || []);

      const dataUsuarios = await fetchAPI('/usuarios');
      setUsuarios(dataUsuarios || []);
    } catch (error) {
      console.error('Error al cargar datos del admin', error);
    } finally {
      setLoading(false);
    }
  };

  const aprobarSolicitud = async (id: number) => {
    if (!confirm('¿Estás seguro de aprobar este préstamo y desembolsar los fondos?')) return;
    
    try {
      const res = await fetchAPI(`/admin/solicitudes/${id}/aprobar`, { method: 'POST' });
      alert(`¡Préstamo aprobado!\nEl cliente debe pagar a la CLABE: ${res.clabe}`);
      cargarDatosAdmin();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const eliminarUsuarioAdmin = async (idUsuario: number, nombre: string) => {
    if (!confirm(`⚠️ ¿Estás seguro de eliminar al usuario "${nombre}"?\nSe borrarán sus préstamos, solicitudes y transacciones asociadas.`)) {
      return;
    }

    try {
      await fetchAPI(`/usuarios/${idUsuario}`, { method: 'DELETE' });
      alert(`Usuario ${nombre} eliminado correctamente.`);
      cargarDatosAdmin();
    } catch (error: any) {
      alert(`Error al eliminar usuario: ${error.message}`);
    }
  };

  const simularPagoSpei = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAPI('/webhooks/spei', {
        method: 'POST',
        body: JSON.stringify({
          clabe: clabeSpei,
          monto: parseFloat(montoSpei)
        })
      });
      alert(`✅ ${res.mensaje}\nSaldo restante: $${res.saldoRestante}`);
      setClabeSpei('');
      setMontoSpei('');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  if (loading) return <div className="p-8">Cargando panel de administrador...</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-800">Backoffice: Control de Préstamos y Operaciones</h1>
      
      {/* SECCIÓN 1: SOLICITUDES PENDIENTES */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Solicitudes Pendientes</h2>
        
        {solicitudes.length === 0 ? (
          <p className="text-slate-500">No hay solicitudes pendientes por revisar.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3">ID</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">CURP</th>
                <th className="p-3">Monto Solicitado</th>
                <th className="p-3">Documentos</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.idSolicitud} className="border-b hover:bg-slate-50">
                  <td className="p-3">#{s.idSolicitud}</td>
                  <td className="p-3 font-medium text-slate-800">{s.nombreCliente}</td>
                  <td className="p-3 text-slate-600 text-sm">{s.curp}</td>
                  <td className="p-3 font-bold text-blue-600">${s.montoSolicitado} <span className="text-xs text-slate-500 font-normal">({s.plazoMeses}m)</span></td>
                  
                  <td className="p-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <a 
                        href={s.ine !== 'Pendiente' ? '#' : undefined} 
                        onClick={(e) => { e.preventDefault(); alert(`Mostrando archivo:\n${s.ine}`); }}
                        className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        📄 INE
                      </a>
                      <a 
                        href={s.recibo !== 'Pendiente' ? '#' : undefined} 
                        onClick={(e) => { e.preventDefault(); alert(`Mostrando archivo:\n${s.recibo}`); }}
                        className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        📄 Luz/Agua
                      </a>
                    </div>
                  </td>

                  <td className="p-3">
                    <button 
                      onClick={() => aprobarSolicitud(s.idSolicitud)}
                      className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 text-sm font-semibold"
                    >
                      Aprobar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SECCIÓN 2: GESTIÓN DE USUARIOS */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Gestión de Usuarios del Sistema</h2>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3">ID</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Correo</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.idUsuario} className="border-b hover:bg-slate-50">
                <td className="p-3">#{u.idUsuario}</td>
                <td className="p-3 font-medium text-slate-800">{u.nombre}</td>
                <td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    u.rol === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {u.rol}
                  </span>
                </td>
                <td className="p-3">
                  {u.rol !== 'ADMIN' && (
                    <button 
                      onClick={() => eliminarUsuarioAdmin(u.idUsuario, u.nombre)}
                      className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1 rounded text-xs font-medium transition-colors"
                    >
                      Eliminar Cuenta
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECCIÓN 3: SIMULADOR SPEI */}
      <div className="bg-slate-800 rounded-xl shadow-md p-6 text-white">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          🏦 Simulador de Transferencias SPEI
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Ingresa la CLABE de un cliente y un monto para simular que el banco nos notificó un pago.
        </p>
        <form onSubmit={simularPagoSpei} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-slate-300">CLABE Interbancaria</label>
            <input 
              type="text" 
              value={clabeSpei}
              onChange={(e) => setClabeSpei(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-400"
              placeholder="Ej. 646180111000000006"
              maxLength={18}
              required 
            />
          </div>
          <div className="w-1/3">
            <label className="block text-sm font-medium mb-1 text-slate-300">Monto a abonar ($)</label>
            <input 
              type="number" 
              value={montoSpei}
              onChange={(e) => setMontoSpei(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-400"
              placeholder="Ej. 1000"
              min="1"
              required 
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-semibold transition-colors">
            Simular Pago
          </button>
        </form>
      </div>
    </div>
  );
}